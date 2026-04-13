#include "GCodeLineSubsystem.h"

#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "Misc/Optional.h"
#include "HAL/PlatformProcess.h"

void UGCodeLineSubsystem::Configure(const FString& InApiBaseUrl, const FString& InAccessToken)
{
    ApiBaseUrl = InApiBaseUrl;
    AccessToken = InAccessToken;
}

void UGCodeLineSubsystem::AuthenticatePlugin(const FString& ProjectId, const FString& PluginVersion, const FString& MachineName)
{
    if (ApiBaseUrl.IsEmpty())
    {
        return;
    }

    TSharedRef<FJsonObject> Payload = MakeShared<FJsonObject>();
    Payload->SetStringField(TEXT("projectId"), ProjectId);
    Payload->SetStringField(TEXT("pluginVersion"), PluginVersion);
    Payload->SetStringField(TEXT("machineName"), MachineName);

    FString Body;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Body);
    FJsonSerializer::Serialize(Payload, Writer);

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(ApiBaseUrl / TEXT("api/integrations/unreal/auth"));
    Request->SetVerb(TEXT("POST"));
    Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    Request->SetContentAsString(Body);
    Request->OnProcessRequestComplete().BindLambda([this](FHttpRequestPtr, FHttpResponsePtr Response, bool bSucceeded)
    {
        if (!bSucceeded || !Response.IsValid())
        {
            return;
        }

        TSharedPtr<FJsonObject> Json;
        TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
        if (FJsonSerializer::Deserialize(Reader, Json) && Json.IsValid())
        {
            AccessToken = Json->GetStringField(TEXT("token"));
        }
    });
    Request->ProcessRequest();
}

void UGCodeLineSubsystem::LinkToTask(const FString& TaskId)
{
    if (ApiBaseUrl.IsEmpty() || TaskId.IsEmpty())
    {
        return;
    }

    const FString Url = FString::Printf(TEXT("%s/tasks/%s"), *ApiBaseUrl, *TaskId);
    FPlatformProcess::LaunchURL(*Url, nullptr, nullptr);
}

void UGCodeLineSubsystem::SendAssetMetadata(const FGCodeLineAssetMetadata& Metadata)
{
    if (ApiBaseUrl.IsEmpty())
    {
        return;
    }

    TSharedRef<FJsonObject> Payload = MakeShared<FJsonObject>();
    Payload->SetStringField(TEXT("projectId"), Metadata.ProjectId);
    if (!Metadata.TaskId.IsEmpty())
    {
        Payload->SetStringField(TEXT("taskId"), Metadata.TaskId);
    }
    Payload->SetStringField(TEXT("unrealGuid"), Metadata.UnrealGuid);
    Payload->SetStringField(TEXT("path"), Metadata.AssetPath);
    Payload->SetStringField(TEXT("hash"), Metadata.Hash);
    Payload->SetNumberField(TEXT("size"), Metadata.Size);

    TArray<TSharedPtr<FJsonValue>> Dependencies;
    for (const FString& Dependency : Metadata.Dependencies)
    {
        Dependencies.Add(MakeShared<FJsonValueString>(Dependency));
    }
    Payload->SetArrayField(TEXT("dependencies"), Dependencies);

    FString Body;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Body);
    FJsonSerializer::Serialize(Payload, Writer);

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(ApiBaseUrl / TEXT("api/integrations/unreal/assets"));
    Request->SetVerb(TEXT("POST"));
    Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));

    if (!AccessToken.IsEmpty())
    {
        Request->SetHeader(TEXT("Authorization"), FString::Printf(TEXT("Bearer %s"), *AccessToken));
    }

    Request->SetContentAsString(Body);
    Request->ProcessRequest();
}

void UGCodeLineSubsystem::UploadSnapshot(const FString& AssetId, const FString& SnapshotBase64)
{
    if (ApiBaseUrl.IsEmpty() || AssetId.IsEmpty() || AccessToken.IsEmpty())
    {
        return;
    }

    TSharedRef<FJsonObject> Payload = MakeShared<FJsonObject>();
    Payload->SetStringField(TEXT("snapshotBase64"), SnapshotBase64);

    FString Body;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Body);
    FJsonSerializer::Serialize(Payload, Writer);

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(ApiBaseUrl / FString::Printf(TEXT("api/integrations/unreal/assets/%s/snapshot"), *AssetId));
    Request->SetVerb(TEXT("POST"));
    Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    Request->SetHeader(TEXT("Authorization"), FString::Printf(TEXT("Bearer %s"), *AccessToken));
    Request->SetContentAsString(Body);
    Request->ProcessRequest();
}
