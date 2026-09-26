#include "plugin_editor_win32.h"
#include "public.sdk/source/vst/hosting/eventlist.h"
#include "public.sdk/source/vst/hosting/hostclasses.h"
#include "public.sdk/source/vst/hosting/module.h"
#include "public.sdk/source/common/memorystream.h"
#include "public.sdk/source/vst/hosting/parameterchanges.h"
#include "public.sdk/source/vst/hosting/plugprovider.h"
#include "public.sdk/source/vst/hosting/processdata.h"
#include "public.sdk/source/vst/utility/stringconvert.h"
#include "pluginterfaces/base/funknown.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "pluginterfaces/vst/vsttypes.h"

#define MINIAUDIO_IMPLEMENTATION
#include "miniaudio.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstdint>
#include <deque>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <memory>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

namespace Steinberg {
FUnknown* gStandardPluginContext = new Vst::HostApplication ();
}

namespace {
using namespace Steinberg;
using namespace Steinberg::Vst;

constexpr uint32_t kChannels = 2;
// One VST3 process call per audio callback. A 1024-frame period gives four
// simultaneous instruments more time to finish transient DSP bursts. MIDI
// sample offsets remain relative to the start of this exact audio block.
constexpr uint32_t kBlockSize = 1024;
constexpr uint32_t kPreferredSampleRate = 48000;
constexpr double kTwoPi = 6.283185307179586476925286766559;

std::string jsonEscape (const std::string& value)
{
    std::ostringstream out;
    for (unsigned char ch : value)
    {
        switch (ch)
        {
            case '\\': out << "\\\\"; break;
            case '"': out << "\\\""; break;
            case '\n': out << "\\n"; break;
            case '\r': out << "\\r"; break;
            case '\t': out << "\\t"; break;
            default:
                if (ch < 0x20)
                {
                    static const char* hex = "0123456789abcdef";
                    out << "\\u00" << hex[(ch >> 4) & 0x0f] << hex[ch & 0x0f];
                }
                else
                    out << static_cast<char> (ch);
        }
    }
    return out.str ();
}

std::string errorJson (const std::string& message)
{
    return "{\"ok\":false,\"error\":\"" + jsonEscape (message) + "\"}";
}

std::vector<std::string> splitTabs (const std::string& line)
{
    std::vector<std::string> parts;
    size_t start = 0;
    while (start <= line.size ())
    {
        const auto pos = line.find ('\t', start);
        if (pos == std::string::npos)
        {
            parts.emplace_back (line.substr (start));
            break;
        }
        parts.emplace_back (line.substr (start, pos - start));
        start = pos + 1;
    }
    return parts;
}

struct PendingNote
{
    bool on {false};
    int32 pitch {60};
    float velocity {0.8f};
    int16 channel {0};
    uint64_t delayFrames {0};
    int32 noteId {-1};
    uint64_t absoluteFrame {0};
};

struct PendingParam
{
    ParamID id {kNoParamId};
    ParamValue value {0.0};
};

class NativeVst3Host
{
public:
    NativeVst3Host ()
    {
        dueNotes_.reserve (1024);
        dueParams_.reserve (1024);
        pendingParams_.reserve (1024);
        PluginContextFactory::instance ().setPluginContext (Steinberg::gStandardPluginContext);
        PlugProvider::setErrorStream (&std::cerr);
    }

    ~NativeVst3Host ()
    {
        unload ();
    }

    void setSampleRate (uint32_t value) { sampleRate_ = value ? value : kPreferredSampleRate; }

    bool load (const std::string& path, std::string& error)
    {
        std::lock_guard<std::mutex> stateLock (stateMutex_);
        unloadUnlocked ();
        resetDiagnostics ();

        module_ = VST3::Hosting::Module::create (path, error);
        if (!module_)
            return false;
        auto factory = module_->getFactory ();
        VST3::Hosting::ClassInfo chosen;
        bool found = false;
        bool chosenInstrument = false;
        for (const auto& classInfo : factory.classInfos ())
        {
            if (classInfo.category () != kVstAudioEffectClass)
                continue;
            const auto sub = classInfo.subCategoriesString ();
            const bool isInstrument = sub.find ("Instrument") != std::string::npos ||
                                      sub.find ("Synth") != std::string::npos;
            if (!found || (isInstrument && !chosenInstrument))
            {
                chosen = classInfo;
                found = true;
                chosenInstrument = isInstrument;
            }
        }
        if (!found)
        {
            error = "No VST3 AudioEffect class was found in this bundle.";
            module_.reset ();
            return false;
        }

        provider_ = Steinberg::owned (new PlugProvider (factory, chosen, true));
        if (!provider_->initialize ())
        {
            error = "VST3 component/controller initialization failed.";
            unloadUnlocked ();
            return false;
        }
        component_ = provider_->getComponentPtr ();
        controller_ = provider_->getControllerPtr ();
        processor_ = FUnknownPtr<IAudioProcessor> (component_);
        if (!component_ || !processor_)
        {
            error = "The selected class does not expose IAudioProcessor.";
            unloadUnlocked ();
            return false;
        }
        if (processor_->canProcessSampleSize (kSample32) != kResultTrue)
        {
            error = "This VST3 does not support 32-bit realtime audio processing.";
            unloadUnlocked ();
            return false;
        }

        configureBusArrangements ();
        mainOutputBus_ = chooseBus (kAudio, kOutput, true);
        mainEventInputBus_ = chooseBus (kEvent, kInput, true);
        activateBuses (kAudio, kOutput, mainOutputBus_);
        activateBuses (kAudio, kInput, -1);
        activateBuses (kEvent, kInput, mainEventInputBus_);
        if (mainOutputBus_ < 0)
        {
            error = "The VST3 exposes no usable audio output bus.";
            unloadUnlocked ();
            return false;
        }
        if (mainEventInputBus_ < 0)
        {
            error = "The VST3 exposes no event input bus for notes.";
            unloadUnlocked ();
            return false;
        }

        processData_.unprepare ();
        if (!processData_.prepare (*component_, static_cast<int32> (kBlockSize), kSample32))
        {
            error = "Could not allocate VST3 process buffers.";
            unloadUnlocked ();
            return false;
        }
        if (mainOutputBus_ >= processData_.numOutputs || !processData_.outputs ||
            processData_.outputs[mainOutputBus_].numChannels <= 0)
        {
            error = "The active VST3 audio output bus has no channels.";
            unloadUnlocked ();
            return false;
        }

        processData_.inputEvents = &events_;
        processData_.inputParameterChanges = &parameterChanges_;
        processData_.processContext = &processContext_;
        processContext_ = {};
        processContext_.sampleRate = static_cast<SampleRate> (sampleRate_);
        processContext_.tempo = 120.0;
        processContext_.timeSigNumerator = 4;
        processContext_.timeSigDenominator = 4;
        processContext_.state = ProcessContext::kPlaying | ProcessContext::kTempoValid |
                                ProcessContext::kTimeSigValid;

        ProcessSetup setup {};
        setup.processMode = kRealtime;
        setup.symbolicSampleSize = kSample32;
        setup.maxSamplesPerBlock = static_cast<int32> (kBlockSize);
        setup.sampleRate = static_cast<SampleRate> (sampleRate_);
        if (processor_->setupProcessing (setup) != kResultOk)
        {
            error = "IAudioProcessor::setupProcessing failed.";
            unloadUnlocked ();
            return false;
        }
        if (component_->setActive (true) != kResultOk)
        {
            error = "VST3 component activation failed.";
            unloadUnlocked ();
            return false;
        }
        if (processor_->setProcessing (true) != kResultOk)
        {
            component_->setActive (false);
            error = "VST3 processing activation failed.";
            unloadUnlocked ();
            return false;
        }

        // The plug-in's declared output latency is distinct from the audio
        // device period. Only advance arrangement events that have an absolute
        // host-frame deadline; live key presses cannot be sent in the past.
        latencySamples_ = std::min<uint32_t> (processor_->getLatencySamples (), sampleRate_ / 2);

        pluginName_ = chosen.name ();
        pluginSubcategory_ = chosen.subCategoriesString ();
        pluginPath_ = path;
        editor_.bind (
            controller_,
            [this] (ParamID id, ParamValue value) { queueProcessorParameter (id, value); },
            [this] (int32 flags) { onEditorRestart (flags); });
        loaded_.store (true);
        idleFramesRemaining_.store (static_cast<int64_t> (sampleRate_));
        quietFrames_ = 0;
        return true;
    }

    void unload ()
    {
        std::lock_guard<std::mutex> stateLock (stateMutex_);
        unloadUnlocked ();
    }

    bool saveState (const std::string& path)
    {
        std::lock_guard<std::mutex> lock (stateMutex_);
        if (!component_ || !controller_) return false;
        MemoryStream componentState, controllerState;
        if (component_->getState (&componentState) != kResultOk) return false;
        controller_->getState (&controllerState);
        constexpr uint32_t limit = 4 * 1024 * 1024;
        if (componentState.getSize () > limit || controllerState.getSize () > limit) return false;
        const auto componentSize = static_cast<uint32_t> (componentState.getSize ());
        const auto controllerSize = static_cast<uint32_t> (controllerState.getSize ());
        std::ofstream file (path, std::ios::binary | std::ios::trunc);
        file.write (reinterpret_cast<const char*> (&componentSize), sizeof (componentSize));
        file.write (reinterpret_cast<const char*> (&controllerSize), sizeof (controllerSize));
        file.write (componentState.getData (), componentSize);
        file.write (controllerState.getData (), controllerSize);
        return file.good ();
    }

    bool loadState (const std::string& path)
    {
        std::lock_guard<std::mutex> lock (stateMutex_);
        if (!component_ || !controller_) return false;
        std::ifstream file (path, std::ios::binary | std::ios::ate);
        if (!file || file.tellg () < 8 || file.tellg () > 8 + 8 * 1024 * 1024) return false;
        const auto total = file.tellg ();
        file.seekg (0);
        uint32_t componentSize = 0, controllerSize = 0;
        file.read (reinterpret_cast<char*> (&componentSize), sizeof (componentSize));
        file.read (reinterpret_cast<char*> (&controllerSize), sizeof (controllerSize));
        if (componentSize > 4 * 1024 * 1024 || controllerSize > 4 * 1024 * 1024 ||
            static_cast<std::streamoff> (8 + componentSize + controllerSize) != total) return false;
        std::vector<char> componentBytes (componentSize), controllerBytes (controllerSize);
        file.read (componentBytes.data (), componentSize);
        file.read (controllerBytes.data (), controllerSize);
        if (!file) return false;
        MemoryStream componentState (componentBytes.data (), componentSize);
        if (processor_) processor_->setProcessing (false);
        component_->setActive (false);
        const auto restored = component_->setState (&componentState) == kResultOk;
        componentState.seek (0, IBStream::kIBSeekSet, nullptr);
        if (restored)
        {
            controller_->setComponentState (&componentState);
            MemoryStream controllerState (controllerBytes.data (), controllerSize);
            if (controllerSize) controller_->setState (&controllerState);
        }
        component_->setActive (true);
        if (processor_) processor_->setProcessing (true);
        if (!restored) return false;
        idleFramesRemaining_.store (static_cast<int64_t> (sampleRate_));
        return true;
    }

    bool queueNote (bool on, int pitch, float velocity, int channel = 0, uint64_t delayFrames = 0,
                    int noteId = -1, uint64_t absoluteFrame = 0)
    {
        pitch = std::max (0, std::min (127, pitch));
        velocity = std::max (0.0f, std::min (1.0f, velocity));
        channel = std::max (0, std::min (15, channel));
        noteId = std::max (-1, std::min (0x7ffffffe, noteId));
        std::lock_guard<std::mutex> lock (queueMutex_);
        if (pendingNotes_.size () >= 8192) return false;
        if (on)
        {
            noteOnQueued_.fetch_add (1);
            activeNotes_.fetch_add (1);
        }
        else
        {
            noteOffQueued_.fetch_add (1);
            auto active = activeNotes_.load ();
            while (active > 0 && !activeNotes_.compare_exchange_weak (active, active - 1)) {}
        }
        const auto keepAlive = static_cast<int64_t> (delayFrames) + static_cast<int64_t> (sampleRate_) * 4;
        auto currentKeepAlive = idleFramesRemaining_.load ();
        while (keepAlive > currentKeepAlive &&
               !idleFramesRemaining_.compare_exchange_weak (currentKeepAlive, keepAlive)) {}
        if (absoluteFrame) absoluteFrame = std::max<uint64_t> (1, absoluteFrame > latencySamples_ ? absoluteFrame - latencySamples_ : 1);
        pendingNotes_.push_back ({on, pitch, velocity, static_cast<int16> (channel), delayFrames, noteId, absoluteFrame});
        return true;
    }

    bool queueParameter (uint32_t id, double value)
    {
        if (!controller_)
            return false;
        value = std::max (0.0, std::min (1.0, value));
        controller_->setParamNormalized (static_cast<ParamID> (id), value);
        queueProcessorParameter (static_cast<ParamID> (id), value);
        return true;
    }

    void clearScheduledEvents ()
    {
        std::lock_guard<std::mutex> lock (queueMutex_);
        pendingNotes_.clear ();
        for (const auto& active : activeNoteIds_)
            pendingNotes_.push_back ({false, active.second.first, 0.0f,
                                      static_cast<int16> (active.second.second), 0, active.first});
        activeNoteIds_.clear ();
        for (int channel = 0; channel < 16; ++channel)
            for (int pitch = 0; pitch < 128; ++pitch)
                pendingNotes_.push_back ({false, pitch, 0.0f, static_cast<int16> (channel), 0});
        activeNotes_.store (0);
        idleFramesRemaining_.store (static_cast<int64_t> (sampleRate_) * 4);
    }

    bool openEditor (std::string& error)
    {
        std::lock_guard<std::mutex> stateLock (stateMutex_);
        if (!loaded_.load () || !controller_)
        {
            error = "No loaded VST3 is available for editing.";
            return false;
        }
        return editor_.open (pluginName_, error);
    }

    void closeEditor ()
    {
        std::lock_guard<std::mutex> stateLock (stateMutex_);
        editor_.close ();
    }

    void pumpEditorMessages () { editor_.pumpMessages (); }

    void startTestTone ()
    {
        testToneFramesRemaining_.store (static_cast<int64_t> (sampleRate_ / 2));
        idleFramesRemaining_.store (static_cast<int64_t> (sampleRate_));
    }

    std::string pluginJson () const
    {
        std::lock_guard<std::mutex> lock (stateMutex_);
        std::ostringstream out;
        out << "{\"ok\":true,\"loaded\":" << (loaded_.load () ? "true" : "false")
            << ",\"name\":\"" << jsonEscape (pluginName_) << "\""
            << ",\"subcategory\":\"" << jsonEscape (pluginSubcategory_) << "\""
            << ",\"path\":\"" << jsonEscape (pluginPath_) << "\""
            << ",\"sample_rate\":" << sampleRate_
            << ",\"main_output_bus\":" << mainOutputBus_
            << ",\"main_output_channels\":" << mainOutputChannelsUnlocked ()
            << ",\"main_event_input_bus\":" << mainEventInputBus_
            << ",\"editor_open\":" << (editor_.isOpen () ? "true" : "false")
            << ",\"bus_arrangement_accepted\":" << (busArrangementAccepted_ ? "true" : "false")
            << ",\"parameter_count\":" << (controller_ ? controller_->getParameterCount () : 0) << "}";
        return out.str ();
    }

    std::string parametersJson () const
    {
        std::lock_guard<std::mutex> lock (stateMutex_);
        if (!controller_)
            return "{\"ok\":false,\"error\":\"No VST3 controller loaded\"}";
        std::ostringstream out;
        out << "{\"ok\":true,\"parameters\":[";
        bool first = true;
        const int32 count = controller_->getParameterCount ();
        for (int32 i = 0; i < count; ++i)
        {
            ParameterInfo info {};
            if (controller_->getParameterInfo (i, info) != kResultOk || (info.flags & ParameterInfo::kIsHidden))
                continue;
            if (!first) out << ',';
            first = false;
            const auto title = StringConvert::convert (info.title, 128);
            const auto units = StringConvert::convert (info.units, 128);
            out << "{\"id\":" << info.id
                << ",\"title\":\"" << jsonEscape (title) << "\""
                << ",\"units\":\"" << jsonEscape (units) << "\""
                << ",\"value\":" << controller_->getParamNormalized (info.id)
                << ",\"default\":" << info.defaultNormalizedValue
                << ",\"step_count\":" << info.stepCount
                << ",\"program_change\":" << ((info.flags & ParameterInfo::kIsProgramChange) ? "true" : "false")
                << ",\"automatable\":" << ((info.flags & ParameterInfo::kCanAutomate) ? "true" : "false")
                << '}';
        }
        out << "]}";
        return out.str ();
    }

    std::string diagnosticsJson () const
    {
        std::lock_guard<std::mutex> lock (stateMutex_);
        std::ostringstream out;
        out << "{\"ok\":true"
            << ",\"audio_started\":true"
            << ",\"idle_suspended\":" << (isIdleSuspended () ? "true" : "false")
            << ",\"loaded\":" << (loaded_.load () ? "true" : "false")
            << ",\"editor_open\":" << (editor_.isOpen () ? "true" : "false")
            << ",\"sample_rate\":" << sampleRate_
            << ",\"reported_latency_samples\":" << latencySamples_
            << ",\"late_note_events\":" << lateNoteEvents_.load ()
            << ",\"max_note_lateness_frames\":" << maxNoteLatenessFrames_.load ()
            << ",\"audio_output_buses\":" << (component_ ? component_->getBusCount (kAudio, kOutput) : 0)
            << ",\"event_input_buses\":" << (component_ ? component_->getBusCount (kEvent, kInput) : 0)
            << ",\"main_output_bus\":" << mainOutputBus_
            << ",\"main_output_channels\":" << mainOutputChannelsUnlocked ()
            << ",\"main_event_input_bus\":" << mainEventInputBus_
            << ",\"bus_arrangement_accepted\":" << (busArrangementAccepted_ ? "true" : "false")
            << ",\"note_on_queued\":" << noteOnQueued_.load ()
            << ",\"note_off_queued\":" << noteOffQueued_.load ()
            << ",\"events_delivered\":" << eventsDelivered_.load ()
            << ",\"event_add_failures\":" << eventAddFailures_.load ()
            << ",\"process_calls\":" << processCalls_.load ()
            << ",\"process_failures\":" << processFailures_.load ()
            << ",\"last_process_result\":" << lastProcessResult_.load ()
            << ",\"last_output_peak\":" << lastOutputPeak_.load ()
            << ",\"max_output_peak\":" << maxOutputPeak_.load ()
            << ",\"test_tone_active\":" << (testToneFramesRemaining_.load () > 0 ? "true" : "false")
            << "}";
        return out.str ();
    }

public:
    bool isIdleSuspended () const
    {
        if (manualSuspended_.load ()) return true;
        if (captureActive_.load ()) return false;
        return activeNotes_.load () <= 0 && idleFramesRemaining_.load () <= 0 &&
               testToneFramesRemaining_.load () <= 0;
    }

    bool prepareCapture (uint32_t frames)
    {
        if (!loaded_.load () || captureActive_.load () || frames == 0 || frames > sampleRate_ * 42) return false;
        manualSuspended_.store (true);
        std::lock_guard<std::mutex> stateLock (stateMutex_);
        std::lock_guard<std::mutex> queueLock (queueMutex_);
        pendingNotes_.clear ();
        pendingParams_.clear ();
        activeNoteIds_.clear ();
        activeNotes_.store (0);
        captureBuffer_.assign (static_cast<size_t> (frames) * kChannels, 0.0f);
        capturedFrames_.store (0);
        captureTargetFrames_ = frames;
        captureActive_.store (false);
        return true;
    }

    void armCapture ()
    {
        captureActive_.store (true);
        manualSuspended_.store (false);
    }

    uint32_t capturedFrames () const { return capturedFrames_.load (); }
    uint32_t captureTargetFrames () const { return captureTargetFrames_; }
    void resume ()
    {
        std::lock_guard<std::mutex> stateLock (stateMutex_);
        std::lock_guard<std::mutex> queueLock (queueMutex_);
        captureActive_.store (false);
        manualSuspended_.store (false);
        pendingNotes_.clear ();
        activeNoteIds_.clear ();
        activeNotes_.store (0);
        captureBuffer_.clear ();
        captureTargetFrames_ = 0;
        idleFramesRemaining_.store (static_cast<int64_t> (sampleRate_));
    }

    bool saveCapture (const std::string& path)
    {
        if (captureActive_.load () || capturedFrames_.load () != captureTargetFrames_ ||
            captureTargetFrames_ == 0) return false;
        std::vector<float> samples;
        { std::lock_guard<std::mutex> stateLock (stateMutex_); samples = captureBuffer_; }
        std::ofstream file (std::filesystem::u8path (path), std::ios::binary | std::ios::trunc);
        if (!file) return false;
        const auto write16 = [&file] (uint16_t n) {
            const char bytes[] = {static_cast<char> (n), static_cast<char> (n >> 8)};
            file.write (bytes, 2);
        };
        const auto write32 = [&file] (uint32_t n) {
            const char bytes[] = {static_cast<char> (n), static_cast<char> (n >> 8),
                                  static_cast<char> (n >> 16), static_cast<char> (n >> 24)};
            file.write (bytes, 4);
        };
        const uint32_t dataBytes = static_cast<uint32_t> (samples.size () * 2);
        file.write ("RIFF", 4); write32 (36 + dataBytes); file.write ("WAVEfmt ", 8);
        write32 (16); write16 (1); write16 (kChannels); write32 (sampleRate_);
        write32 (sampleRate_ * kChannels * 2); write16 (kChannels * 2); write16 (16);
        file.write ("data", 4); write32 (dataBytes);
        for (float sample : samples)
        {
            const auto value = static_cast<int16_t> (std::lround (
                std::max (-1.0f, std::min (1.0f, sample)) * 32767.0f));
            write16 (static_cast<uint16_t> (value));
        }
        const bool saved = file.good ();
        if (saved)
        {
            std::lock_guard<std::mutex> stateLock (stateMutex_);
            captureBuffer_.clear ();
            captureTargetFrames_ = 0;
        }
        return saved;
    }

    static void dataCallback (ma_device* device, void* output, const void*, ma_uint32 frameCount)
    {
        auto* self = static_cast<NativeVst3Host*> (device->pUserData);
        self->render (static_cast<float*> (output), frameCount, 0);
    }

    void queueProcessorParameter (ParamID id, ParamValue value)
    {
        value = std::max<ParamValue> (0.0, std::min<ParamValue> (1.0, value));
        idleFramesRemaining_.store (std::max<int64_t> (idleFramesRemaining_.load (), sampleRate_ / 2));
        std::lock_guard<std::mutex> lock (queueMutex_);
        pendingParams_.push_back ({id, value});
        if (pendingParams_.size () > 1024)
            pendingParams_.erase (pendingParams_.begin (), pendingParams_.begin () + 512);
    }

    void syncControllerParameters ()
    {
        if (!controller_)
            return;
        const int32 count = controller_->getParameterCount ();
        for (int32 i = 0; i < count; ++i)
        {
            ParameterInfo info {};
            if (controller_->getParameterInfo (i, info) == kResultOk)
                queueProcessorParameter (info.id, controller_->getParamNormalized (info.id));
        }
    }

    void onEditorRestart (int32 flags)
    {
        if ((flags & kParamValuesChanged) != 0)
            syncControllerParameters ();
    }

    static SpeakerArrangement fallbackArrangement (int32 channels)
    {
        if (channels == 1) return SpeakerArr::kMono;
        if (channels == 2) return SpeakerArr::kStereo;
        return 0;
    }

    void configureBusArrangements ()
    {
        const int32 inputCount = component_->getBusCount (kAudio, kInput);
        const int32 outputCount = component_->getBusCount (kAudio, kOutput);
        std::vector<SpeakerArrangement> inputs (static_cast<size_t> (std::max<int32> (0, inputCount)), 0);
        std::vector<SpeakerArrangement> outputs (static_cast<size_t> (std::max<int32> (0, outputCount)), 0);
        bool complete = true;
        auto resolve = [this, &complete] (BusDirection dir, int32 index, SpeakerArrangement& arrangement) {
            if (processor_->getBusArrangement (dir, index, arrangement) == kResultTrue &&
                SpeakerArr::getChannelCount (arrangement) > 0)
                return;
            BusInfo info {};
            if (component_->getBusInfo (kAudio, dir, index, info) != kResultTrue)
            {
                complete = false;
                return;
            }
            arrangement = fallbackArrangement (info.channelCount);
            if (arrangement == 0 && info.channelCount > 0)
                complete = false;
        };
        for (int32 i = 0; i < inputCount; ++i) resolve (kInput, i, inputs[static_cast<size_t> (i)]);
        for (int32 i = 0; i < outputCount; ++i) resolve (kOutput, i, outputs[static_cast<size_t> (i)]);
        busArrangementAccepted_ = false;
        if (complete && outputCount > 0)
        {
            const auto result = processor_->setBusArrangements (
                inputs.empty () ? nullptr : inputs.data (), inputCount,
                outputs.empty () ? nullptr : outputs.data (), outputCount);
            busArrangementAccepted_ = result == kResultTrue;
        }
    }

    int32 chooseBus (MediaType mediaType, BusDirection direction, bool forceFirstMain) const
    {
        const int32 count = component_->getBusCount (mediaType, direction);
        int32 firstMain = -1;
        int32 firstDefault = -1;
        for (int32 i = 0; i < count; ++i)
        {
            BusInfo info {};
            if (component_->getBusInfo (mediaType, direction, i, info) != kResultTrue)
                continue;
            if (firstDefault < 0 && (info.flags & BusInfo::kDefaultActive)) firstDefault = i;
            if (firstMain < 0 && info.busType == kMain) firstMain = i;
        }
        if (forceFirstMain && firstMain >= 0) return firstMain;
        if (firstDefault >= 0) return firstDefault;
        if (firstMain >= 0) return firstMain;
        return count > 0 ? 0 : -1;
    }

    void activateBuses (MediaType mediaType, BusDirection direction, int32 forcedBus)
    {
        const int32 count = component_->getBusCount (mediaType, direction);
        for (int32 i = 0; i < count; ++i)
        {
            BusInfo info {};
            bool active = i == forcedBus;
            if (component_->getBusInfo (mediaType, direction, i, info) == kResultTrue)
                active = active || ((info.flags & BusInfo::kDefaultActive) != 0);
            component_->activateBus (mediaType, direction, i, active);
        }
    }

    void render (float* output, ma_uint32 frameCount, uint64_t startFrame)
    {
        std::fill (output, output + static_cast<size_t> (frameCount) * kChannels, 0.0f);
        if (loaded_.load () && !isIdleSuspended ())
        {
            std::lock_guard<std::mutex> stateLock (stateMutex_);
            if (processor_ && component_)
            {
                ma_uint32 rendered = 0;
                while (rendered < frameCount)
                {
                    const int32 chunk = static_cast<int32> (std::min<ma_uint32> (kBlockSize, frameCount - rendered));
                    events_.clear ();
                    parameterChanges_.clearQueue ();
                    const bool queueEmpty = drainPendingChanges (chunk, startFrame + rendered);
                    clearProcessInputs (chunk);
                    clearProcessOutputs (chunk);
                    processData_.numSamples = chunk;
                    processContext_.projectTimeSamples = processedSamples_;
                    const auto result = processor_->process (processData_);
                    processCalls_.fetch_add (1);
                    lastProcessResult_.store (static_cast<int32_t> (result));
                    if (result == kResultOk)
                        copyOutputs (output + static_cast<size_t> (rendered) * kChannels, chunk);
                    else
                        processFailures_.fetch_add (1);
                    processedSamples_ += chunk;
                    // Only suspend after a sustained inaudible tail. A scheduled note still
                    // waiting in the queue must keep the processor alive.
                    if (activeNotes_.load () <= 0 && queueEmpty &&
                        lastOutputPeak_.load () < 0.0001f)
                        quietFrames_ += static_cast<uint32_t> (chunk);
                    else
                        quietFrames_ = 0;
                    if (quietFrames_ >= sampleRate_ / 2)
                        idleFramesRemaining_.store (0);
                    rendered += static_cast<ma_uint32> (chunk);
                }
            }
            if (activeNotes_.load () <= 0)
                idleFramesRemaining_.fetch_sub (static_cast<int64_t> (frameCount));
        }
        if (captureActive_.load ())
        {
            std::lock_guard<std::mutex> stateLock (stateMutex_);
            if (captureActive_.load () && captureTargetFrames_ > capturedFrames_.load ())
            {
                const uint32_t captured = capturedFrames_.load ();
                const auto count = std::min (frameCount, captureTargetFrames_ - captured);
                std::copy_n (output, static_cast<size_t> (count) * kChannels,
                             captureBuffer_.begin () + static_cast<size_t> (captured) * kChannels);
                capturedFrames_.store (captured + count);
                if (captured + count >= captureTargetFrames_)
                {
                    captureActive_.store (false);
                    manualSuspended_.store (true);
                }
            }
        }
        addTestTone (output, frameCount);
    }

    bool drainPendingChanges (int32 chunkFrames, uint64_t startFrame)
    {
        dueNotes_.clear ();
        dueParams_.clear ();
        bool queueEmpty = false;
        {
            std::lock_guard<std::mutex> lock (queueMutex_);
            pendingNotes_.erase (std::remove_if (pendingNotes_.begin (), pendingNotes_.end (),
                [this, chunkFrames, startFrame] (PendingNote& note) {
                    if (note.absoluteFrame)
                    {
                        if (note.absoluteFrame >= startFrame + static_cast<uint64_t> (chunkFrames)) return false;
                        if (note.on && note.absoluteFrame < startFrame)
                        {
                            lateNoteEvents_.fetch_add (1);
                            const auto lateness = std::min<uint64_t> (startFrame - note.absoluteFrame, sampleRate_ * 60ULL);
                            auto maximum = maxNoteLatenessFrames_.load ();
                            while (lateness > maximum && !maxNoteLatenessFrames_.compare_exchange_weak (maximum, lateness)) {}
                        }
                        note.delayFrames = note.absoluteFrame > startFrame ? note.absoluteFrame - startFrame : 0;
                        dueNotes_.push_back (note);
                        return true;
                    }
                    if (note.delayFrames < static_cast<uint64_t> (chunkFrames))
                    {
                        dueNotes_.push_back (note);
                        return true;
                    }
                    note.delayFrames -= static_cast<uint64_t> (chunkFrames);
                    return false;
                }), pendingNotes_.end ());
            dueParams_.swap (pendingParams_);
            for (const auto& note : dueNotes_)
            {
                if (note.noteId < 0) continue;
                if (note.on) activeNoteIds_[note.noteId] = {note.pitch, note.channel};
                else activeNoteIds_.erase (note.noteId);
            }
            queueEmpty = pendingNotes_.empty () && dueNotes_.empty () && dueParams_.empty ();
        }
        for (const auto& note : dueNotes_)
        {
            Event event {};
            event.busIndex = mainEventInputBus_ >= 0 ? mainEventInputBus_ : 0;
            event.sampleOffset = static_cast<int32> (note.delayFrames);
            event.ppqPosition = 0.0;
            event.flags = Event::kIsLive;
            if (note.on)
            {
                event.type = Event::kNoteOnEvent;
                event.noteOn.channel = note.channel;
                event.noteOn.pitch = static_cast<int16> (note.pitch);
                event.noteOn.tuning = 0.0f;
                event.noteOn.velocity = note.velocity;
                event.noteOn.length = 0;
                event.noteOn.noteId = note.noteId;
            }
            else
            {
                event.type = Event::kNoteOffEvent;
                event.noteOff.channel = note.channel;
                event.noteOff.pitch = static_cast<int16> (note.pitch);
                event.noteOff.tuning = 0.0f;
                event.noteOff.velocity = note.velocity;
                event.noteOff.noteId = note.noteId;
            }
            if (events_.addEvent (event) == kResultOk) eventsDelivered_.fetch_add (1);
            else eventAddFailures_.fetch_add (1);
        }
        for (const auto& param : dueParams_)
        {
            int32 queueIndex = 0;
            auto* queue = parameterChanges_.addParameterData (param.id, queueIndex);
            if (queue)
            {
                int32 pointIndex = 0;
                queue->addPoint (0, param.value, pointIndex);
            }
        }
        return queueEmpty;
    }

    void clearProcessInputs (int32 frames)
    {
        for (int32 bus = 0; bus < processData_.numInputs; ++bus)
        {
            auto& b = processData_.inputs[bus];
            for (int32 channel = 0; channel < b.numChannels; ++channel)
                if (b.channelBuffers32 && b.channelBuffers32[channel])
                    std::fill (b.channelBuffers32[channel], b.channelBuffers32[channel] + frames, 0.0f);
            b.silenceFlags = HostProcessData::kAllChannelsSilent;
        }
    }

    void clearProcessOutputs (int32 frames)
    {
        for (int32 bus = 0; bus < processData_.numOutputs; ++bus)
        {
            auto& b = processData_.outputs[bus];
            for (int32 channel = 0; channel < b.numChannels; ++channel)
                if (b.channelBuffers32 && b.channelBuffers32[channel])
                    std::fill (b.channelBuffers32[channel], b.channelBuffers32[channel] + frames, 0.0f);
            b.silenceFlags = 0;
        }
    }

    void updateMaxPeak (float peak)
    {
        auto current = maxOutputPeak_.load ();
        while (peak > current && !maxOutputPeak_.compare_exchange_weak (current, peak)) {}
    }

    void copyOutputs (float* destination, int32 frames)
    {
        if (mainOutputBus_ < 0 || mainOutputBus_ >= processData_.numOutputs || !processData_.outputs)
            return;
        auto& bus = processData_.outputs[mainOutputBus_];
        float peak = 0.0f;
        for (int32 frame = 0; frame < frames; ++frame)
        {
            float left = 0.0f;
            float right = 0.0f;
            if (bus.numChannels > 0 && bus.channelBuffers32 && bus.channelBuffers32[0]) left = bus.channelBuffers32[0][frame];
            if (bus.numChannels > 1 && bus.channelBuffers32 && bus.channelBuffers32[1]) right = bus.channelBuffers32[1][frame];
            else right = left;
            destination[static_cast<size_t> (frame) * 2] = left;
            destination[static_cast<size_t> (frame) * 2 + 1] = right;
            peak = std::max (peak, std::max (std::abs (left), std::abs (right)));
        }
        lastOutputPeak_.store (peak);
        updateMaxPeak (peak);
    }

    void addTestTone (float* output, ma_uint32 frameCount)
    {
        auto remaining = testToneFramesRemaining_.load ();
        if (remaining <= 0) return;
        const auto frames = static_cast<ma_uint32> (std::min<int64_t> (remaining, frameCount));
        const double phaseStep = kTwoPi * 440.0 / static_cast<double> (sampleRate_);
        for (ma_uint32 frame = 0; frame < frames; ++frame)
        {
            const float sample = static_cast<float> (std::sin (testTonePhase_) * 0.12);
            testTonePhase_ += phaseStep;
            if (testTonePhase_ >= kTwoPi) testTonePhase_ -= kTwoPi;
            output[static_cast<size_t> (frame) * 2] += sample;
            output[static_cast<size_t> (frame) * 2 + 1] += sample;
        }
        testToneFramesRemaining_.fetch_sub (static_cast<int64_t> (frames));
    }

    int32 mainOutputChannelsUnlocked () const
    {
        if (mainOutputBus_ < 0 || mainOutputBus_ >= processData_.numOutputs || !processData_.outputs) return 0;
        return processData_.outputs[mainOutputBus_].numChannels;
    }

    void resetDiagnostics ()
    {
        noteOnQueued_.store (0); noteOffQueued_.store (0); eventsDelivered_.store (0); eventAddFailures_.store (0);
        lateNoteEvents_.store (0); maxNoteLatenessFrames_.store (0);
        processCalls_.store (0); processFailures_.store (0); lastProcessResult_.store (0);
        lastOutputPeak_.store (0.0f); maxOutputPeak_.store (0.0f); processedSamples_ = 0;
    }

    void unloadUnlocked ()
    {
        loaded_.store (false);
        captureActive_.store (false);
        manualSuspended_.store (false);
        captureTargetFrames_ = 0;
        captureBuffer_.clear ();
        activeNotes_.store (0);
        idleFramesRemaining_.store (0);
        quietFrames_ = 0;
        editor_.unbind ();
        {
            std::lock_guard<std::mutex> lock (queueMutex_);
            pendingNotes_.clear ();
            pendingParams_.clear ();
            activeNoteIds_.clear ();
        }
        if (processor_) processor_->setProcessing (false);
        if (component_) component_->setActive (false);
        processData_.unprepare ();
        processor_ = nullptr;
        controller_ = nullptr;
        component_ = nullptr;
        provider_ = nullptr;
        module_.reset ();
        mainOutputBus_ = -1;
        mainEventInputBus_ = -1;
        latencySamples_ = 0;
        busArrangementAccepted_ = false;
        pluginName_.clear ();
        pluginSubcategory_.clear ();
        pluginPath_.clear ();
    }

    mutable std::mutex stateMutex_;
    std::mutex queueMutex_;
    std::vector<PendingNote> pendingNotes_;
    std::unordered_map<int32, std::pair<int32, int16>> activeNoteIds_;
    std::vector<PendingParam> pendingParams_;
    // Render-only scratch; retain capacity across callbacks.
    std::vector<PendingNote> dueNotes_;
    std::vector<PendingParam> dueParams_;
    uint32_t sampleRate_ {kPreferredSampleRate};
    uint32_t latencySamples_ {0};
    uint32_t quietFrames_ {0};
    std::atomic<bool> manualSuspended_ {false};
    std::atomic<bool> captureActive_ {false};
    std::atomic<uint32_t> capturedFrames_ {0};
    uint32_t captureTargetFrames_ {0};
    std::vector<float> captureBuffer_;
    std::atomic<bool> loaded_ {false};
    VST3::Hosting::Module::Ptr module_;
    IPtr<PlugProvider> provider_;
    IPtr<IComponent> component_;
    IPtr<IEditController> controller_;
    FUnknownPtr<IAudioProcessor> processor_;
    HostProcessData processData_;
    EventList events_;
    ParameterChanges parameterChanges_;
    ProcessContext processContext_ {};
    PluginEditorWin32 editor_;
    int32 mainOutputBus_ {-1};
    int32 mainEventInputBus_ {-1};
    bool busArrangementAccepted_ {false};
    int64 processedSamples_ {0};
    std::atomic<uint64_t> noteOnQueued_ {0};
    std::atomic<uint64_t> noteOffQueued_ {0};
    std::atomic<uint64_t> eventsDelivered_ {0};
    std::atomic<uint64_t> eventAddFailures_ {0};
    std::atomic<uint64_t> lateNoteEvents_ {0};
    std::atomic<uint64_t> maxNoteLatenessFrames_ {0};
    std::atomic<uint64_t> processCalls_ {0};
    std::atomic<uint64_t> processFailures_ {0};
    std::atomic<int32_t> lastProcessResult_ {0};
    std::atomic<float> lastOutputPeak_ {0.0f};
    std::atomic<float> maxOutputPeak_ {0.0f};
    std::atomic<int64_t> testToneFramesRemaining_ {0};
    std::atomic<int32_t> activeNotes_ {0};
    std::atomic<int64_t> idleFramesRemaining_ {0};
    double testTonePhase_ {0.0};
    std::string pluginName_;
    std::string pluginSubcategory_;
    std::string pluginPath_;
};

class NativeVst3Rack
{
public:
    static constexpr size_t kMaxInstances = 24;

    ~NativeVst3Rack () { stopAudio (); }

    bool startAudio ()
    {
        ma_device_config config = ma_device_config_init (ma_device_type_playback);
        config.playback.format = ma_format_f32;
        config.playback.channels = kChannels;
        config.sampleRate = kPreferredSampleRate;
        config.periodSizeInFrames = kBlockSize;
        config.dataCallback = &NativeVst3Rack::dataCallback;
        config.pUserData = this;
        if (ma_device_init (nullptr, &config, &device_) != MA_SUCCESS) return false;
        sampleRate_ = device_.sampleRate ? device_.sampleRate : kPreferredSampleRate;
        scratch_.resize (static_cast<size_t> (kBlockSize) * kChannels * 4);
        if (ma_device_start (&device_) != MA_SUCCESS)
        {
            ma_device_uninit (&device_);
            return false;
        }
        audioStarted_ = true;
        return true;
    }

    void stopAudio ()
    {
        if (!audioStarted_) return;
        ma_device_uninit (&device_);
        audioStarted_ = false;
    }

    NativeVst3Host* find (const std::string& id)
    {
        std::lock_guard<std::mutex> lock (mutex_);
        const auto it = instances_.find (id);
        return it == instances_.end () ? nullptr : it->second.get ();
    }

    uint32_t sampleRate () const { return sampleRate_; }
    uint64_t frameClock () const { return frameClock_.load (); }

    NativeVst3Host* create (const std::string& id, std::string& error)
    {
        std::lock_guard<std::mutex> lock (mutex_);
        const auto existing = instances_.find (id);
        if (existing != instances_.end ()) return existing->second.get ();
        if (instances_.size () >= kMaxInstances)
        {
            error = "VST3 instance limit reached.";
            return nullptr;
        }
        auto host = std::make_unique<NativeVst3Host> ();
        host->setSampleRate (sampleRate_);
        auto* result = host.get ();
        instances_.emplace (id, std::move (host));
        return result;
    }

    void remove (const std::string& id)
    {
        std::lock_guard<std::mutex> lock (mutex_);
        instances_.erase (id);
    }

    void pumpEditorMessages ()
    {
        std::lock_guard<std::mutex> lock (mutex_);
        for (auto& pair : instances_) pair.second->pumpEditorMessages ();
    }

    std::string statusJson ()
    {
        std::lock_guard<std::mutex> lock (mutex_);
        size_t suspended = 0;
        for (const auto& pair : instances_) if (pair.second->isIdleSuspended ()) ++suspended;
        std::ostringstream out;
        out << "{\"ok\":true,\"audio_started\":" << (audioStarted_ ? "true" : "false")
            << ",\"sample_rate\":" << sampleRate_
            << ",\"instance_count\":" << instances_.size ()
            << ",\"idle_suspended_count\":" << suspended
            << ",\"cpu_load_percent\":" << cpuLoadPercent_.load ()
            << ",\"audio_overruns\":" << audioOverruns_.load ()
            << ",\"frame_clock\":" << frameClock_.load ()
            << ",\"single_audio_device\":true}";
        return out.str ();
    }

private:
    static void dataCallback (ma_device* device, void* output, const void*, ma_uint32 frames)
    {
        auto* rack = static_cast<NativeVst3Rack*> (device->pUserData);
        const auto started = std::chrono::steady_clock::now ();
        const auto startFrame = rack->frameClock_.fetch_add (frames);
        rack->render (static_cast<float*> (output), frames, startFrame);
        const auto elapsed = std::chrono::duration<double> (std::chrono::steady_clock::now () - started).count ();
        const auto budget = static_cast<double> (frames) / static_cast<double> (rack->sampleRate_);
        const float percent = budget > 0.0 ? static_cast<float> (elapsed / budget * 100.0) : 0.0f;
        const float previous = rack->cpuLoadPercent_.load ();
        rack->cpuLoadPercent_.store (previous * 0.9f + percent * 0.1f);
        if (elapsed > budget) rack->audioOverruns_.fetch_add (1);
    }

    void render (float* output, ma_uint32 frames, uint64_t startFrame)
    {
        const auto samples = static_cast<size_t> (frames) * kChannels;
        std::fill (output, output + samples, 0.0f);
        std::lock_guard<std::mutex> lock (mutex_);
        bool hasActiveOutput = false;
        for (auto& pair : instances_)
        {
            if (pair.second->isIdleSuspended ()) continue;
            if (!hasActiveOutput)
            {
                pair.second->render (output, frames, startFrame);
                hasActiveOutput = true;
                continue;
            }
            if (scratch_.size () < samples) scratch_.resize (samples);
            pair.second->render (scratch_.data (), frames, startFrame);
            for (size_t i = 0; i < samples; ++i) output[i] += scratch_[i];
        }
        if (hasActiveOutput)
            for (size_t i = 0; i < samples; ++i) output[i] = std::max (-1.0f, std::min (1.0f, output[i]));
    }

    std::mutex mutex_;
    std::unordered_map<std::string, std::unique_ptr<NativeVst3Host>> instances_;
    std::vector<float> scratch_;
    ma_device device_ {};
    uint32_t sampleRate_ {kPreferredSampleRate};
    bool audioStarted_ {false};
    std::atomic<float> cpuLoadPercent_ {0.0f};
    std::atomic<uint64_t> audioOverruns_ {0};
    std::atomic<uint64_t> frameClock_ {0};
};

bool processCommand (NativeVst3Rack& rack, const std::string& line)
{
    const auto parts = splitTabs (line);
    if (parts.empty ()) return true;
    try
    {
        if (parts[0] == "PING")
            std::cout << "{\"ok\":true,\"pong\":true}" << std::endl;
        else if (parts[0] == "LOAD" && parts.size () >= 3)
        {
            std::string error;
            auto* host = rack.create (parts[1], error);
            std::cout << (host && host->load (parts[2], error) ? host->pluginJson () : errorJson (error)) << std::endl;
        }
        else if (parts[0] == "STATUS") std::cout << rack.statusJson () << std::endl;
        else if (parts[0] == "DIAGNOSTICS" && parts.size () >= 2)
        {
            auto* host = rack.find (parts[1]);
            std::cout << (host ? host->diagnosticsJson () : errorJson ("Unknown VST3 instance")) << std::endl;
        }
        else if (parts[0] == "TEST_TONE" && parts.size () >= 2)
        {
            auto* host = rack.find (parts[1]);
            if (host) { host->startTestTone (); std::cout << "{\"ok\":true,\"test_tone\":true}" << std::endl; }
            else std::cout << errorJson ("Unknown VST3 instance") << std::endl;
        }
        else if (parts[0] == "EDITOR_OPEN" && parts.size () >= 2)
        {
            std::string error;
            auto* host = rack.find (parts[1]);
            if (host && host->openEditor (error)) std::cout << "{\"ok\":true,\"editor_open\":true}" << std::endl;
            else std::cout << errorJson (error) << std::endl;
        }
        else if (parts[0] == "EDITOR_CLOSE" && parts.size () >= 2)
        {
            auto* host = rack.find (parts[1]);
            if (host) { host->closeEditor (); std::cout << "{\"ok\":true,\"editor_open\":false}" << std::endl; }
            else std::cout << errorJson ("Unknown VST3 instance") << std::endl;
        }
        else if (parts[0] == "PARAMS" && parts.size () >= 2)
        {
            auto* host = rack.find (parts[1]);
            std::cout << (host ? host->parametersJson () : errorJson ("Unknown VST3 instance")) << std::endl;
        }
        else if (parts[0] == "PARAM" && parts.size () >= 4)
        {
            auto* host = rack.find (parts[1]);
            const auto id = static_cast<uint32_t> (std::stoul (parts[2]));
            const auto value = std::stod (parts[3]);
            std::cout << (host && host->queueParameter (id, value) ? "{\"ok\":true}" : errorJson ("No controller loaded")) << std::endl;
        }
        else if (parts[0] == "STATE_SAVE" && parts.size () >= 3)
        {
            auto* host = rack.find (parts[1]);
            std::cout << (host && host->saveState (parts[2]) ? "{\"ok\":true}" :
                          errorJson ("VST3 state could not be saved")) << std::endl;
        }
        else if (parts[0] == "STATE_LOAD" && parts.size () >= 3)
        {
            auto* host = rack.find (parts[1]);
            std::cout << (host && host->loadState (parts[2]) ? "{\"ok\":true}" :
                          errorJson ("VST3 state could not be restored")) << std::endl;
        }
        else if (parts[0] == "FREEZE_PREPARE" && parts.size () >= 3)
        {
            auto* host = rack.find (parts[1]);
            const auto frames = std::stoul (parts[2]);
            std::cout << (host && host->prepareCapture (frames) ? "{\"ok\":true}" :
                          errorJson ("Capture duration or VST3 instance is invalid")) << std::endl;
        }
        else if (parts[0] == "FREEZE_ARM" && parts.size () >= 2)
        {
            auto* host = rack.find (parts[1]);
            if (host) { host->armCapture (); std::cout << "{\"ok\":true}" << std::endl; }
            else std::cout << errorJson ("Unknown VST3 instance") << std::endl;
        }
        else if (parts[0] == "FREEZE_STATUS" && parts.size () >= 2)
        {
            auto* host = rack.find (parts[1]);
            if (host) std::cout << "{\"ok\":true,\"frames\":" << host->capturedFrames ()
                                << ",\"target_frames\":" << host->captureTargetFrames () << "}" << std::endl;
            else std::cout << errorJson ("Unknown VST3 instance") << std::endl;
        }
        else if (parts[0] == "FREEZE_SAVE" && parts.size () >= 3)
        {
            auto* host = rack.find (parts[1]);
            std::cout << (host && host->saveCapture (parts[2]) ? "{\"ok\":true}" :
                          errorJson ("Capture is incomplete or cannot be saved")) << std::endl;
        }
        else if (parts[0] == "FREEZE_RESUME" && parts.size () >= 2)
        {
            auto* host = rack.find (parts[1]);
            if (host) { host->resume (); std::cout << "{\"ok\":true}" << std::endl; }
            else std::cout << errorJson ("Unknown VST3 instance") << std::endl;
        }
        else if (parts[0] == "NOTE_ON" && parts.size () >= 4)
        {
            auto* host = rack.find (parts[1]);
            const auto channel = parts.size () >= 5 ? std::stoi (parts[4]) : 0;
            const auto noteId = parts.size () >= 6 ? std::stoi (parts[5]) : -1;
            if (host) { const bool queued = host->queueNote (true, std::stoi (parts[2]), static_cast<float> (std::stod (parts[3])), channel, 0, noteId); std::cout << (queued ? "{\"ok\":true}" : errorJson ("VST3 event queue is full")) << std::endl; }
            else std::cout << errorJson ("Unknown VST3 instance") << std::endl;
        }
        else if (parts[0] == "NOTE_OFF" && parts.size () >= 3)
        {
            auto* host = rack.find (parts[1]);
            const auto channel = parts.size () >= 4 ? std::stoi (parts[3]) : 0;
            const auto noteId = parts.size () >= 5 ? std::stoi (parts[4]) : -1;
            if (host) { const bool queued = host->queueNote (false, std::stoi (parts[2]), 0.0f, channel, 0, noteId); std::cout << (queued ? "{\"ok\":true}" : errorJson ("VST3 event queue is full")) << std::endl; }
            else std::cout << errorJson ("Unknown VST3 instance") << std::endl;
        }
        else if (parts[0] == "BATCH" && parts.size () >= 3)
        {
            auto* host = rack.find (parts[1]);
            if (!host) std::cout << errorJson ("Unknown VST3 instance") << std::endl;
            else
            {
                size_t accepted = 0;
                bool overflow = false;
                std::stringstream eventStream (parts[2]);
                std::string encoded;
                while (accepted < 1024 && std::getline (eventStream, encoded, ';'))
                {
                    std::stringstream fields (encoded);
                    std::vector<std::string> values;
                    std::string value;
                    while (std::getline (fields, value, ',')) values.push_back (value);
                    if (values.size () < 5) continue;
                    const bool on = values[0] == "1";
                    const auto delayFrames = static_cast<uint64_t> (
                        std::max (0.0, std::stod (values[4])) * static_cast<double> (rack.sampleRate ()) / 1000.0);
                    const auto absoluteFrame = values.size () >= 7 ? std::stoull (values[6]) : 0;
                    const auto reservedFrames = absoluteFrame > rack.frameClock () ?
                        std::max (delayFrames, absoluteFrame - rack.frameClock ()) : delayFrames;
                    if (!host->queueNote (on, std::stoi (values[1]), static_cast<float> (std::stod (values[2])),
                                     std::stoi (values[3]), reservedFrames, values.size () >= 6 ? std::stoi (values[5]) : -1,
                                     absoluteFrame)) { overflow = true; break; }
                    ++accepted;
                }
                if (!overflow) std::cout << "{\"ok\":true,\"accepted\":" << accepted << "}" << std::endl;
                else std::cout << errorJson ("VST3 event queue is full") << std::endl;
            }
        }
        else if (parts[0] == "CLEAR" && parts.size () >= 2)
        {
            auto* host = rack.find (parts[1]);
            if (host) { host->clearScheduledEvents (); std::cout << "{\"ok\":true}" << std::endl; }
            else std::cout << errorJson ("Unknown VST3 instance") << std::endl;
        }
        else if (parts[0] == "UNLOAD" && parts.size () >= 2)
        {
            rack.remove (parts[1]);
            std::cout << "{\"ok\":true}" << std::endl;
        }
        else if (parts[0] == "QUIT")
        {
            std::cout << "{\"ok\":true,\"bye\":true}" << std::endl;
            return false;
        }
        else std::cout << errorJson ("Unknown or malformed command") << std::endl;
    }
    catch (const std::exception& exc)
    {
        std::cout << errorJson (exc.what ()) << std::endl;
    }
    return true;
}

} // namespace

int main ()
{
    NativeVst3Rack rack;
    if (!rack.startAudio ())
    {
        std::cout << errorJson ("Could not open the default audio output device.") << std::endl;
        return 2;
    }

    std::mutex commandMutex;
    std::condition_variable commandCv;
    std::deque<std::string> commands;
    std::atomic<bool> inputClosed {false};
    std::thread reader ([&] {
        std::string line;
        while (std::getline (std::cin, line))
        {
            {
                std::lock_guard<std::mutex> lock (commandMutex);
                commands.push_back (std::move (line));
            }
            commandCv.notify_one ();
        }
        inputClosed.store (true);
        commandCv.notify_one ();
    });

    std::cout << "{\"ok\":true,\"ready\":true,\"protocol\":4,\"single_audio_device\":true}" << std::endl;
    bool running = true;
    while (running)
    {
        rack.pumpEditorMessages ();
        std::string line;
        {
            std::unique_lock<std::mutex> lock (commandMutex);
            commandCv.wait_for (lock, std::chrono::milliseconds (8), [&] {
                return !commands.empty () || inputClosed.load ();
            });
            if (!commands.empty ())
            {
                line = std::move (commands.front ());
                commands.pop_front ();
            }
            else if (inputClosed.load ())
                break;
        }
        if (!line.empty ())
            running = processCommand (rack, line);
    }

    if (reader.joinable ())
    {
        if (!inputClosed.load ())
            CancelSynchronousIo (reader.native_handle ());
        reader.join ();
    }
    return 0;
}
