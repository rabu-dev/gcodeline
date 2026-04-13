#pragma once

#include "CoreMinimal.h"
#include "Subsystems/EditorSubsystem.h"
#include "GCodeLineSubsystem.generated.h"

USTRUCT(BlueprintType)
struct FGCodeLineAssetMetadata
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "GCodeLine")
    FString ProjectId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "GCodeLine")
    FString TaskId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "GCodeLine")
    FString UnrealGuid;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "GCodeLine")
    FString AssetPath;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "GCodeLine")
    FString Hash;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "GCodeLine")
    int32 Size = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "GCodeLine")
    TArray<FString> Dependencies;
};

UCLASS()
class GCODELINE_API UGCodeLineSubsystem : public UEditorSubsystem
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "GCodeLine")
    void Configure(const FString& InApiBaseUrl, const FString& InAccessToken);

    UFUNCTION(BlueprintCallable, Category = "GCodeLine")
    void AuthenticatePlugin(const FString& ProjectId, const FString& PluginVersion, const FString& MachineName);

    UFUNCTION(BlueprintCallable, Category = "GCodeLine")
    void LinkToTask(const FString& TaskId);

    UFUNCTION(BlueprintCallable, Category = "GCodeLine")
    void SendAssetMetadata(const FGCodeLineAssetMetadata& Metadata);

    UFUNCTION(BlueprintCallable, Category = "GCodeLine")
    void UploadSnapshot(const FString& AssetId, const FString& SnapshotBase64);

private:
    FString ApiBaseUrl;
    FString AccessToken;
};
