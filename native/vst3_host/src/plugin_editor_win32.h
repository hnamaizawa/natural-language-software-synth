#pragma once

#include "pluginterfaces/gui/iplugview.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <functional>
#include <string>

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
    static LRESULT CALLBACK windowProc (HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam);
    LRESULT handleWindowMessage (UINT message, WPARAM wParam, LPARAM lParam);
    bool registerWindowClass (std::string& error);
    void detachView ();

    Steinberg::Vst::IEditController* controller_ {nullptr};
    Steinberg::IPtr<Steinberg::IPlugView> view_;
    ParameterEditCallback parameterEdit_;
    RestartCallback restart_;
    HWND window_ {nullptr};
};
