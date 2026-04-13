# GCodeLine Unreal Plugin

Esqueleto inicial para Unreal Engine 5.x.

## MVP del plugin

- autenticacion contra la plataforma
- envio de metadata JSON de assets
- accion "Link to Task"
- base para thumbnails y artifact bundles

## Flujo previsto

1. El usuario configura la URL del backend y el token del proyecto.
2. El editor recopila metadata del asset seleccionado.
3. El plugin envia un `POST /api/integrations/unreal/assets`.
4. La plataforma relaciona el asset con una tarea y actualiza el timeline.

## Archivos clave

- `GCodeLine.uplugin`
- `Source/GCodeLine/GCodeLine.Build.cs`
- `Source/GCodeLine/Public/GCodeLineSubsystem.h`
- `Source/GCodeLine/Private/GCodeLineSubsystem.cpp`
