#include "plugin_editor_win32.h"

#include "pluginterfaces/base/funknown.h"

#include <algorithm>
#include <vector>

namespace {
constexpr wchar_t kWindowClassName[] = L"NLSS VST3 Editor Window";

std::wstring utf8ToWide (const std::string& text)
{
    if (text.empty ())
        return L"VST3 Editor";
    const int count = MultiByteToWideChar (CP_UTF8, 0, text.c_str (), -1, nullptr, 0);
    if (count <= 1)
        return L"VST3 Editor";
    std::vector<wchar_t> buffer (static_cast<size_t> (count));
    MultiByteToWideChar (CP_UTF8, 0, text.c_str (), -1, buffer.data (), count);
    return std::wstring (buffer.data ());
}
} // namespace

PluginEditorWin32::~PluginEditorWin32 ()
{
    unbind ();
}

void PluginEditorWin32::bind (Steinberg::Vst::IEditController* controller,
                              ParameterEditCallback parameterEdit, RestartCallback restart)
{
    unbind ();
    controller_ = controller;
    parameterEdit_ = std::move (parameterEdit);
    restart_ = std::move (restart);
    if (controller_)
        controller_->setComponentHandler (this);
}

void PluginEditorWin32::unbind ()
{
    close ();
    if (controller_)
        controller_->setComponentHandler (nullptr);
    controller_ = nullptr;
    parameterEdit_ = {};
    restart_ = {};
}

bool PluginEditorWin32::registerWindowClass (std::string& error)
{
    static bool registered = false;
    if (registered)
        return true;

    WNDCLASSEXW wc {};
    wc.cbSize = sizeof (wc);
    wc.style = CS_DBLCLKS;
    wc.lpfnWndProc = &PluginEditorWin32::windowProc;
    wc.hInstance = GetModuleHandleW (nullptr);
    wc.hCursor = LoadCursor (nullptr, IDC_ARROW);
    wc.lpszClassName = kWindowClassName;
    if (!RegisterClassExW (&wc) && GetLastError () != ERROR_CLASS_ALREADY_EXISTS)
    {
        error = "Could not register the VST3 editor window class.";
        return false;
    }
    registered = true;
    return true;
}

bool PluginEditorWin32::open (const std::string& title, std::string& error)
{
    if (!controller_)
    {
        error = "No VST3 edit controller is loaded.";
        return false;
    }
    if (window_)
    {
        ShowWindow (window_, SW_RESTORE);
        SetForegroundWindow (window_);
        return true;
    }
    if (!registerWindowClass (error))
        return false;

    view_ = Steinberg::owned (controller_->createView (Steinberg::Vst::ViewType::kEditor));
    if (!view_)
    {
        error = "This VST3 does not provide its own editor window.";
        return false;
    }
    if (view_->isPlatformTypeSupported (Steinberg::kPlatformTypeHWND) != Steinberg::kResultTrue)
    {
        error = "This VST3 editor does not support a Windows HWND host.";
        view_ = nullptr;
        return false;
    }

    Steinberg::ViewRect size {};
    if (view_->getSize (&size) != Steinberg::kResultTrue)
    {
        error = "The VST3 editor did not provide a usable window size.";
        view_ = nullptr;
        return false;
    }
    const int width = std::max<int> (120, size.right - size.left);
    const int height = std::max<int> (80, size.bottom - size.top);
    DWORD style = WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX | WS_CLIPCHILDREN | WS_CLIPSIBLINGS;
    if (view_->canResize () == Steinberg::kResultTrue)
        style |= WS_THICKFRAME | WS_MAXIMIZEBOX;
    RECT rect {0, 0, width, height};
    AdjustWindowRectEx (&rect, style, FALSE, WS_EX_APPWINDOW);

    const auto windowTitle = utf8ToWide (title.empty () ? "VST3 Editor" : title + " - VST3 Editor");
    window_ = CreateWindowExW (
        WS_EX_APPWINDOW, kWindowClassName, windowTitle.c_str (), style, CW_USEDEFAULT, CW_USEDEFAULT,
        rect.right - rect.left, rect.bottom - rect.top, nullptr, nullptr, GetModuleHandleW (nullptr), this);
    if (!window_)
    {
        error = "Could not create the native VST3 editor window.";
        view_ = nullptr;
        return false;
    }

    view_->setFrame (this);
    if (view_->attached (window_, Steinberg::kPlatformTypeHWND) != Steinberg::kResultTrue)
    {
        error = "The VST3 editor could not attach to the native Windows window.";
        view_->setFrame (nullptr);
        DestroyWindow (window_);
        window_ = nullptr;
        view_ = nullptr;
        return false;
    }

    ShowWindow (window_, SW_SHOW);
    UpdateWindow (window_);
    SetForegroundWindow (window_);
    return true;
}

void PluginEditorWin32::detachView ()
{
    if (!view_)
        return;
    view_->setFrame (nullptr);
    view_->removed ();
    view_ = nullptr;
}

void PluginEditorWin32::close ()
{
    HWND window = window_;
    window_ = nullptr;
    detachView ();
    if (window && IsWindow (window))
        DestroyWindow (window);
}

void PluginEditorWin32::pumpMessages ()
{
    MSG message {};
    while (PeekMessageW (&message, nullptr, 0, 0, PM_REMOVE))
    {
        TranslateMessage (&message);
        DispatchMessageW (&message);
    }
}

LRESULT CALLBACK PluginEditorWin32::windowProc (HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam)
{
    PluginEditorWin32* self = reinterpret_cast<PluginEditorWin32*> (GetWindowLongPtrW (hwnd, GWLP_USERDATA));
    if (message == WM_NCCREATE)
    {
        const auto* create = reinterpret_cast<CREATESTRUCTW*> (lParam);
        self = static_cast<PluginEditorWin32*> (create->lpCreateParams);
        SetWindowLongPtrW (hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR> (self));
    }
    if (self)
        return self->handleWindowMessage (message, wParam, lParam);
    return DefWindowProcW (hwnd, message, wParam, lParam);
}

LRESULT PluginEditorWin32::handleWindowMessage (UINT message, WPARAM wParam, LPARAM lParam)
{
    switch (message)
    {
        case WM_SIZE:
            if (view_ && window_)
            {
                RECT client {};
                GetClientRect (window_, &client);
                Steinberg::ViewRect rect {0, 0, client.right - client.left, client.bottom - client.top};
                view_->onSize (&rect);
            }
            return 0;
        case WM_CLOSE:
        {
            HWND window = window_;
            window_ = nullptr;
            detachView ();
            if (window)
                DestroyWindow (window);
            return 0;
        }
        case WM_DESTROY:
            window_ = nullptr;
            return 0;
        default:
            break;
    }
    return DefWindowProcW (window_, message, wParam, lParam);
}

Steinberg::tresult PLUGIN_API PluginEditorWin32::resizeView (Steinberg::IPlugView* view,
                                                              Steinberg::ViewRect* newSize)
{
    if (!window_ || !view || !newSize || view != view_.get ())
        return Steinberg::kInvalidArgument;
    RECT rect {0, 0, newSize->right - newSize->left, newSize->bottom - newSize->top};
    const auto style = static_cast<DWORD> (GetWindowLongPtrW (window_, GWL_STYLE));
    const auto exStyle = static_cast<DWORD> (GetWindowLongPtrW (window_, GWL_EXSTYLE));
    AdjustWindowRectEx (&rect, style, FALSE, exStyle);
    if (!SetWindowPos (window_, nullptr, 0, 0, rect.right - rect.left, rect.bottom - rect.top,
                       SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE))
        return Steinberg::kResultFalse;
    return Steinberg::kResultTrue;
}

Steinberg::tresult PLUGIN_API PluginEditorWin32::beginEdit (Steinberg::Vst::ParamID)
{
    return Steinberg::kResultTrue;
}

Steinberg::tresult PLUGIN_API PluginEditorWin32::performEdit (
    Steinberg::Vst::ParamID id, Steinberg::Vst::ParamValue valueNormalized)
{
    if (parameterEdit_)
        parameterEdit_ (id, valueNormalized);
    return Steinberg::kResultTrue;
}

Steinberg::tresult PLUGIN_API PluginEditorWin32::endEdit (Steinberg::Vst::ParamID)
{
    return Steinberg::kResultTrue;
}

Steinberg::tresult PLUGIN_API PluginEditorWin32::restartComponent (Steinberg::int32 flags)
{
    if (restart_)
        restart_ (flags);
    return Steinberg::kResultTrue;
}

Steinberg::tresult PLUGIN_API PluginEditorWin32::queryInterface (const Steinberg::TUID iid, void** obj)
{
    if (!obj)
        return Steinberg::kInvalidArgument;
    *obj = nullptr;
    if (Steinberg::FUnknownPrivate::iidEqual (iid, Steinberg::IPlugFrame::iid))
        *obj = static_cast<Steinberg::IPlugFrame*> (this);
    else if (Steinberg::FUnknownPrivate::iidEqual (iid, Steinberg::Vst::IComponentHandler::iid))
        *obj = static_cast<Steinberg::Vst::IComponentHandler*> (this);
    else if (Steinberg::FUnknownPrivate::iidEqual (iid, Steinberg::FUnknown::iid))
        *obj = static_cast<Steinberg::IPlugFrame*> (this);
    if (!*obj)
        return Steinberg::kNoInterface;
    addRef ();
    return Steinberg::kResultTrue;
}
