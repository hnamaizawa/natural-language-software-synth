#pragma once

#include "pluginterfaces/gui/iplugview.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"

#include <functional>
#include <string>

struct HWND__;
using HWND = HWND__*;

class PluginEditorWin32 final : public Steinberg::IPlugFrame, public Steinberg::Vst::IComponentHandler
{
public:
    using ParameterEditCallback = std::function<void (Steinberg::Vst::ParamID, Steinberg::Vst::ParamValue)>;
    using RestartCallback = std::function<void (Steinberg::int32)>;

    PluginEditorWin32 () = default;
    ~PluginEditorWin32 () override;

    void bind (Steinberg::Vst::IEditController* controller, ParameterEditCallback parameterEdit,
               RestartCallback restart);
    void unbind ();
    bool open (const std::string& title, std::string& error);
    void close ();
    void pumpMessages ();
    bool isOpen () const { return window_ != nullptr; }

    Steinberg::tresult PLUGIN_API resizeView (Steinberg::IPlugView* view,
                                               Steinberg::ViewRect* newSize) override;

    Steinberg::tresult PLUGIN_API beginEdit (Steinberg::Vst::ParamID id) override;
    Steinberg::tresult PLUGIN_API performEdit (Steinberg::Vst::ParamID id,
                                                Steinberg::Vst::ParamValue valueNormalized) override;
    Steinberg::tresult PLUGIN_API endEdit (Steinberg::Vst::ParamID id) override;
    Steinberg::tresult PLUGIN_API restartComponent (Steinberg::int32 flags) override;

    Steinberg::tresult PLUGIN_API queryInterface (const Steinberg::TUID iid, void** obj) override;
    Steinberg::uint32 PLUGIN_API addRef () override { return 1000; }
    Steinberg::uint32 PLUGIN_API release () override { return 1000; }

private:
    static long long __stdcall windowProc (HWND hwnd, unsigned int message, unsigned long long wParam,
                                            long long lParam);
    long long handleWindowMessage (unsigned int message, unsigned long long wParam, long long lParam);
    bool registerWindowClass (std::string& error);
    void detachView ();

    Steinberg::Vst::IEditController* controller_ {nullptr};
    Steinberg::IPtr<Steinberg::IPlugView> view_;
    ParameterEditCallback parameterEdit_;
    RestartCallback restart_;
    HWND window_ {nullptr};
};
