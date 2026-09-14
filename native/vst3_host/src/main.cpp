#include "public.sdk/source/vst/hosting/eventlist.h"
#include "public.sdk/source/vst/hosting/hostclasses.h"
#include "public.sdk/source/vst/hosting/module.h"
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
#include <cctype>
#include <cstdint>
#include <iostream>
#include <memory>
#include <mutex>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

namespace Steinberg {
FUnknown* gStandardPluginContext = new Vst::HostApplication ();
}

namespace {
using namespace Steinberg;
using namespace Steinberg::Vst;

constexpr uint32_t kChannels = 2;
constexpr uint32_t kBlockSize = 256;
constexpr uint32_t kPreferredSampleRate = 48000;

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

std::vector<std::string> splitTabs (const std::string& line)
{
    std::vector<std::string> parts;
    size_t start = 0;
    while (start <= line.size ())
    {
        auto pos = line.find ('\t', start);
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
        PluginContextFactory::instance ().setPluginContext (Steinberg::gStandardPluginContext);
        PlugProvider::setErrorStream (&std::cerr);
    }

    ~NativeVst3Host ()
    {
        stopAudio ();
        unload ();
    }

    bool startAudio ()
    {
        ma_device_config config = ma_device_config_init (ma_device_type_playback);
        config.playback.format = ma_format_f32;
        config.playback.channels = kChannels;
        config.sampleRate = kPreferredSampleRate;
        config.periodSizeInFrames = kBlockSize;
        config.dataCallback = &NativeVst3Host::dataCallback;
        config.pUserData = this;
        if (ma_device_init (nullptr, &config, &device_) != MA_SUCCESS)
            return false;
        sampleRate_ = device_.sampleRate ? device_.sampleRate : kPreferredSampleRate;
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
        if (!audioStarted_)
            return;
        ma_device_uninit (&device_);
        audioStarted_ = false;
    }

    bool load (const std::string& path, std::string& error)
    {
        std::lock_guard<std::mutex> stateLock (stateMutex_);
        unloadUnlocked ();

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

        for (int32 i = 0; i < component_->getBusCount (kAudio, kOutput); ++i)
            component_->activateBus (kAudio, kOutput, i, true);
        for (int32 i = 0; i < component_->getBusCount (kAudio, kInput); ++i)
            component_->activateBus (kAudio, kInput, i, true);
        for (int32 i = 0; i < component_->getBusCount (kEvent, kInput); ++i)
            component_->activateBus (kEvent, kInput, i, true);

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
        if (component_->setActive (true) != kResultOk || processor_->setProcessing (true) != kResultOk)
        {
            error = "VST3 activation failed.";
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
        processData_.inputEvents = &events_;
        processData_.inputParameterChanges = &parameterChanges_;
        processData_.processContext = &processContext_;
        processContext_ = {};
        processContext_.sampleRate = static_cast<SampleRate> (sampleRate_);
        processContext_.tempo = 120.0;
        processContext_.timeSigNumerator = 4;
        processContext_.timeSigDenominator = 4;
        processContext_.state = ProcessContext::kTempoValid | ProcessContext::kTimeSigValid;

        pluginName_ = chosen.name ();
        pluginSubcategory_ = chosen.subCategoriesString ();
        pluginPath_ = path;
        loaded_.store (true);
        return true;
    }

    void unload ()
    {
        std::lock_guard<std::mutex> stateLock (stateMutex_);
        unloadUnlocked ();
    }

    void queueNote (bool on, int pitch, float velocity)
    {
        pitch = std::max (0, std::min (127, pitch));
        velocity = std::max (0.0f, std::min (1.0f, velocity));
        std::lock_guard<std::mutex> lock (queueMutex_);
        pendingNotes_.push_back ({on, pitch, velocity});
        if (pendingNotes_.size () > 1024)
            pendingNotes_.erase (pendingNotes_.begin (), pendingNotes_.begin () + 512);
    }

    bool queueParameter (uint32_t id, double value)
    {
        if (!controller_)
            return false;
        value = std::max (0.0, std::min (1.0, value));
        controller_->setParamNormalized (static_cast<ParamID> (id), value);
        std::lock_guard<std::mutex> lock (queueMutex_);
        pendingParams_.push_back ({static_cast<ParamID> (id), value});
        if (pendingParams_.size () > 1024)
            pendingParams_.erase (pendingParams_.begin (), pendingParams_.begin () + 512);
        return true;
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
            if (controller_->getParameterInfo (i, info) != kResultOk)
                continue;
            if (info.flags & ParameterInfo::kIsHidden)
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
                << ",\"automatable\":" << ((info.flags & ParameterInfo::kCanAutomate) ? "true" : "false")
                << '}';
        }
        out << "]}";
        return out.str ();
    }

private:
    static void dataCallback (ma_device* device, void* output, const void*, ma_uint32 frameCount)
    {
        auto* self = static_cast<NativeVst3Host*> (device->pUserData);
        self->render (static_cast<float*> (output), frameCount);
    }

    void render (float* output, ma_uint32 frameCount)
    {
        std::fill (output, output + static_cast<size_t> (frameCount) * kChannels, 0.0f);
        if (!loaded_.load ())
            return;

        std::lock_guard<std::mutex> stateLock (stateMutex_);
        if (!processor_ || !component_)
            return;

        ma_uint32 rendered = 0;
        while (rendered < frameCount)
        {
            const int32 chunk = static_cast<int32> (std::min<ma_uint32> (kBlockSize, frameCount - rendered));
            events_.clear ();
            parameterChanges_.clearQueue ();
            drainPendingChanges ();
            clearProcessInputs (chunk);
            processData_.numSamples = chunk;
            processContext_.projectTimeSamples += chunk;

            if (processor_->process (processData_) == kResultOk)
                copyOutputs (output + static_cast<size_t> (rendered) * kChannels, chunk);
            rendered += static_cast<ma_uint32> (chunk);
        }
    }

    void drainPendingChanges ()
    {
        std::vector<PendingNote> notes;
        std::vector<PendingParam> params;
        {
            std::lock_guard<std::mutex> lock (queueMutex_);
            notes.swap (pendingNotes_);
            params.swap (pendingParams_);
        }
        for (const auto& note : notes)
        {
            Event event {};
            event.busIndex = 0;
            event.sampleOffset = 0;
            event.ppqPosition = 0.0;
            if (note.on)
            {
                event.type = Event::kNoteOnEvent;
                event.noteOn.channel = 0;
                event.noteOn.pitch = static_cast<int16> (note.pitch);
                event.noteOn.tuning = 0.0f;
                event.noteOn.velocity = note.velocity;
                event.noteOn.length = 0;
                event.noteOn.noteId = -1;
            }
            else
            {
                event.type = Event::kNoteOffEvent;
                event.noteOff.channel = 0;
                event.noteOff.pitch = static_cast<int16> (note.pitch);
                event.noteOff.tuning = 0.0f;
                event.noteOff.velocity = note.velocity;
                event.noteOff.noteId = -1;
            }
            events_.addEvent (event);
        }
        for (const auto& param : params)
        {
            int32 queueIndex = 0;
            auto* queue = parameterChanges_.addParameterData (param.id, queueIndex);
            if (queue)
            {
                int32 pointIndex = 0;
                queue->addPoint (0, param.value, pointIndex);
            }
        }
    }

    void clearProcessInputs (int32 frames)
    {
        for (int32 bus = 0; bus < processData_.numInputs; ++bus)
        {
            auto& b = processData_.inputs[bus];
            for (int32 channel = 0; channel < b.numChannels; ++channel)
            {
                if (b.channelBuffers32 && b.channelBuffers32[channel])
                    std::fill (b.channelBuffers32[channel], b.channelBuffers32[channel] + frames, 0.0f);
            }
            b.silenceFlags = HostProcessData::kAllChannelsSilent;
        }
    }

    void copyOutputs (float* destination, int32 frames)
    {
        if (processData_.numOutputs <= 0 || !processData_.outputs)
            return;
        auto& bus = processData_.outputs[0];
        for (int32 frame = 0; frame < frames; ++frame)
        {
            float left = 0.0f;
            float right = 0.0f;
            if (bus.numChannels > 0 && bus.channelBuffers32 && bus.channelBuffers32[0])
                left = bus.channelBuffers32[0][frame];
            if (bus.numChannels > 1 && bus.channelBuffers32 && bus.channelBuffers32[1])
                right = bus.channelBuffers32[1][frame];
            else
                right = left;
            destination[static_cast<size_t> (frame) * 2] = left;
            destination[static_cast<size_t> (frame) * 2 + 1] = right;
        }
    }

    void unloadUnlocked ()
    {
        loaded_.store (false);
        {
            std::lock_guard<std::mutex> lock (queueMutex_);
            pendingNotes_.clear ();
            pendingParams_.clear ();
        }
        if (processor_)
            processor_->setProcessing (false);
        if (component_)
            component_->setActive (false);
        processData_.unprepare ();
        processor_ = nullptr;
        controller_ = nullptr;
        component_ = nullptr;
        provider_ = nullptr;
        module_.reset ();
        pluginName_.clear ();
        pluginSubcategory_.clear ();
        pluginPath_.clear ();
    }

    mutable std::mutex stateMutex_;
    std::mutex queueMutex_;
    std::vector<PendingNote> pendingNotes_;
    std::vector<PendingParam> pendingParams_;

    ma_device device_ {};
    bool audioStarted_ {false};
    uint32_t sampleRate_ {kPreferredSampleRate};
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

    std::string pluginName_;
    std::string pluginSubcategory_;
    std::string pluginPath_;
};

std::string errorJson (const std::string& message)
{
    return "{\"ok\":false,\"error\":\"" + jsonEscape (message) + "\"}";
}

} // namespace

int main ()
{
    NativeVst3Host host;
    if (!host.startAudio ())
    {
        std::cout << errorJson ("Could not open the default audio output device.") << std::endl;
        return 2;
    }

    std::cout << "{\"ok\":true,\"ready\":true,\"protocol\":1}" << std::endl;
    std::string line;
    while (std::getline (std::cin, line))
    {
        const auto parts = splitTabs (line);
        if (parts.empty ())
            continue;
        try
        {
            if (parts[0] == "PING")
                std::cout << "{\"ok\":true,\"pong\":true}" << std::endl;
            else if (parts[0] == "LOAD" && parts.size () >= 2)
            {
                std::string error;
                if (host.load (parts[1], error))
                    std::cout << host.pluginJson () << std::endl;
                else
                    std::cout << errorJson (error) << std::endl;
            }
            else if (parts[0] == "STATUS")
                std::cout << host.pluginJson () << std::endl;
            else if (parts[0] == "PARAMS")
                std::cout << host.parametersJson () << std::endl;
            else if (parts[0] == "PARAM" && parts.size () >= 3)
            {
                const auto id = static_cast<uint32_t> (std::stoul (parts[1]));
                const auto value = std::stod (parts[2]);
                std::cout << (host.queueParameter (id, value) ? "{\"ok\":true}" : errorJson ("No controller loaded")) << std::endl;
            }
            else if (parts[0] == "NOTE_ON" && parts.size () >= 3)
            {
                host.queueNote (true, std::stoi (parts[1]), static_cast<float> (std::stod (parts[2])));
                std::cout << "{\"ok\":true}" << std::endl;
            }
            else if (parts[0] == "NOTE_OFF" && parts.size () >= 2)
            {
                host.queueNote (false, std::stoi (parts[1]), 0.0f);
                std::cout << "{\"ok\":true}" << std::endl;
            }
            else if (parts[0] == "UNLOAD")
            {
                host.unload ();
                std::cout << "{\"ok\":true}" << std::endl;
            }
            else if (parts[0] == "QUIT")
            {
                std::cout << "{\"ok\":true,\"bye\":true}" << std::endl;
                break;
            }
            else
                std::cout << errorJson ("Unknown or malformed command") << std::endl;
        }
        catch (const std::exception& exc)
        {
            std::cout << errorJson (exc.what ()) << std::endl;
        }
    }
    return 0;
}
