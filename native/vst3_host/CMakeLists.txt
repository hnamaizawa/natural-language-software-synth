cmake_minimum_required(VERSION 3.25)
project(nlss_vst3_host VERSION 0.7.2 LANGUAGES C CXX)

include(FetchContent)

# Keep the native host small: we need Steinberg hosting helpers, not the SDK examples/UI.
set(SMTG_ENABLE_VST3_PLUGIN_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SMTG_ENABLE_VST3_HOSTING_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SMTG_ENABLE_VSTGUI_SUPPORT OFF CACHE BOOL "" FORCE)
set(SMTG_ENABLE_WAYLAND_SUPPORT OFF CACHE BOOL "" FORCE)
set(SMTG_CREATE_PLUGIN_LINK OFF CACHE BOOL "" FORCE)

FetchContent_Declare(
  vst3sdk
  GIT_REPOSITORY https://github.com/steinbergmedia/vst3sdk.git
  GIT_TAG 3cdf9ca5d1f5b1b21e0a86832aa4abe55607bd96
  GIT_SHALLOW FALSE
  GIT_SUBMODULES_RECURSE TRUE
)
FetchContent_MakeAvailable(vst3sdk)

FetchContent_Declare(
  miniaudio
  GIT_REPOSITORY https://github.com/mackron/miniaudio.git
  GIT_TAG 9634bedb5b5a2ca38c1ee7108a9358a4e233f14d
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(miniaudio)

# Steinberg's host examples link sdk_hosting and compile PlugProvider plus the
# platform-specific Module implementation in the host executable itself.
# sdk_hosting intentionally does not contain those two implementation units.
add_executable(nlss_vst3_host
  src/main.cpp
  src/plugin_editor_win32.cpp
  ${vst3sdk_SOURCE_DIR}/public.sdk/source/common/memorystream.cpp
  ${vst3sdk_SOURCE_DIR}/public.sdk/source/vst/hosting/plugprovider.cpp
  ${vst3sdk_SOURCE_DIR}/public.sdk/source/vst/hosting/module_win32.cpp
)
target_compile_features(nlss_vst3_host PRIVATE cxx_std_17)
target_compile_definitions(nlss_vst3_host PRIVATE NOMINMAX WIN32_LEAN_AND_MEAN)
target_include_directories(nlss_vst3_host PRIVATE
  ${vst3sdk_SOURCE_DIR}
  ${miniaudio_SOURCE_DIR}
)
target_link_libraries(nlss_vst3_host PRIVATE sdk_hosting user32)

if(MSVC)
  target_compile_options(nlss_vst3_host PRIVATE /W4 /permissive-)
endif()
