import type { FC } from "react";
import type * as TypesGen from "#/api/typesGenerated";
import { Alert, AlertDescription } from "#/components/Alert/Alert";
import { Button } from "#/components/Button/Button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/Select/Select";
import { useModelOverrideForm } from "../hooks/useModelOverrideForm";
import { ModelSelector, type ModelSelectorOption } from "./ChatElements";
import { ModelOverrideAlerts } from "./ModelOverrideAlerts";
import { SectionHeader } from "./SectionHeader";

type PersonalOverrideContext = TypesGen.ChatPersonalModelOverrideContext;
type PersonalOverrideMode = TypesGen.ChatPersonalModelOverrideMode;
type PersonalOverride = TypesGen.ChatPersonalModelOverride;
type UpdatePersonalOverrideRequest =
	TypesGen.UpdateUserChatPersonalModelOverrideRequest;

interface MutationCallbacks {
	onSuccess?: () => void;
	onError?: () => void;
}

export type SavePersonalOverride = (
	req: UpdatePersonalOverrideRequest,
	options?: MutationCallbacks,
) => void;

interface PersonalOverrideFormValues {
	mode: PersonalOverrideMode;
	model_config_id: string;
}

interface PersonalModelOverrideRowProps {
	context: PersonalOverrideContext;
	title: string;
	description: string;
	overrideData: PersonalOverride | undefined;
	modelOptions: readonly ModelSelectorOption[];
	modelConfigs: readonly TypesGen.ChatModelConfig[];
	modelConfigsError: unknown;
	isLoading: boolean;
	onSave: SavePersonalOverride;
	isSaving: boolean;
	isSaveError: boolean;
	saveErrorMessage: string;
	disabled: boolean;
}

const getDefaultMode = (
	context: PersonalOverrideContext,
): PersonalOverrideMode => {
	return context === "root" ? "chat_default" : "deployment_default";
};

const toFormValues = (
	overrideData: PersonalOverride | undefined,
	context: PersonalOverrideContext,
): PersonalOverrideFormValues => {
	if (!overrideData || overrideData.is_malformed) {
		return { mode: getDefaultMode(context), model_config_id: "" };
	}
	return {
		mode: overrideData.mode,
		model_config_id:
			overrideData.mode === "model" ? overrideData.model_config_id : "",
	};
};

const toUpdateRequest = (
	values: PersonalOverrideFormValues,
): UpdatePersonalOverrideRequest => {
	if (values.mode === "model") {
		return {
			mode: "model",
			model_config_id: values.model_config_id,
		};
	}
	return { mode: values.mode, model_config_id: "" };
};

const getModeLabel = (mode: PersonalOverrideMode): string => {
	switch (mode) {
		case "chat_default":
			return "Chat default";
		case "deployment_default":
			return "Deployment default";
		case "model":
			return "Specific model";
	}
};

const getModelConfigLabel = (modelConfig: TypesGen.ChatModelConfig): string => {
	return modelConfig.display_name.trim() || modelConfig.model || modelConfig.id;
};

const getUnavailableModelLabel = (
	modelConfigID: string,
	modelConfigs: readonly TypesGen.ChatModelConfig[],
): string => {
	const modelConfig = modelConfigs.find(
		(config) => config.id === modelConfigID,
	);
	if (!modelConfig) {
		return `Unavailable model (${modelConfigID})`;
	}
	return `Unavailable: ${getModelConfigLabel(modelConfig)}`;
};

const getOfferedModes = (
	context: PersonalOverrideContext,
): readonly PersonalOverrideMode[] => {
	return context === "root"
		? ["chat_default", "model"]
		: ["deployment_default", "chat_default", "model"];
};

const selectorTriggerClassName =
	"h-10 w-full justify-between rounded-md border border-border border-solid bg-transparent px-3 text-sm shadow-sm md:w-[18rem]";

export const PersonalModelOverrideRow: FC<PersonalModelOverrideRowProps> = ({
	context,
	title,
	description,
	overrideData,
	modelOptions,
	modelConfigs,
	modelConfigsError,
	isLoading,
	onSave,
	isSaving,
	isSaveError,
	saveErrorMessage,
	disabled,
}) => {
	const hasLoadedOverride = overrideData !== undefined;
	const isMalformedOverride = overrideData?.is_malformed ?? false;
	const { form, isFormDisabled, canSave } = useModelOverrideForm({
		initialValues: toFormValues(overrideData, context),
		onSubmit: (values, { resetForm }) => {
			onSave(toUpdateRequest(values), {
				onSuccess: () => resetForm({ values }),
			});
		},
		isLoading,
		isSaving,
		disabled,
		hasLoadedOverride,
		isMalformedOverride,
	});
	const offeredModes = getOfferedModes(context);
	const isInvalidRootDeploymentDefault =
		context === "root" && overrideData?.mode === "deployment_default";
	const isUnavailableSavedModel =
		overrideData?.mode === "model" &&
		overrideData.is_set &&
		overrideData.model_config_id.trim() !== "" &&
		!modelOptions.some((option) => option.id === overrideData.model_config_id);
	const isUnavailableSelectedModel =
		form.values.mode === "model" &&
		form.values.model_config_id.trim() !== "" &&
		!modelOptions.some((option) => option.id === form.values.model_config_id);
	const modelSelectorPlaceholder = isUnavailableSelectedModel
		? getUnavailableModelLabel(form.values.model_config_id, modelConfigs)
		: "Select model";
	const canSaveSelection =
		canSave &&
		(form.values.mode !== "model" || form.values.model_config_id.trim() !== "");

	return (
		<section aria-label={title} className="flex flex-col gap-3">
			<SectionHeader label={title} description={description} level="section" />
			<form className="flex flex-col gap-3" onSubmit={form.handleSubmit}>
				<Select
					value={form.values.mode}
					onValueChange={(mode: PersonalOverrideMode) => {
						void form.setFieldValue("mode", mode);
					}}
					disabled={isFormDisabled}
				>
					<SelectTrigger
						aria-label={`${title} behavior`}
						className={selectorTriggerClassName}
					>
						<SelectValue placeholder="Select behavior" />
					</SelectTrigger>
					<SelectContent className="min-w-[18rem]">
						{offeredModes.map((mode) => (
							<SelectItem key={mode} value={mode}>
								{getModeLabel(mode)}
							</SelectItem>
						))}
						{isInvalidRootDeploymentDefault && (
							<SelectItem value="deployment_default" disabled>
								Invalid deployment default
							</SelectItem>
						)}
					</SelectContent>
				</Select>
				{form.values.mode === "model" && (
					<ModelSelector
						options={modelOptions}
						value={form.values.model_config_id}
						onValueChange={(value) => {
							void form.setFieldValue("model_config_id", value);
						}}
						disabled={isFormDisabled}
						placeholder={modelSelectorPlaceholder}
						emptyMessage={
							isLoading ? "Loading models..." : "No enabled models found."
						}
						className={selectorTriggerClassName}
						contentClassName="min-w-[18rem]"
					/>
				)}
				<ModelOverrideAlerts
					isUnavailableSavedModel={isUnavailableSavedModel}
					unavailableMessage="The saved model is unavailable and will be ignored until you choose a valid model override."
					isMalformedOverride={isMalformedOverride}
					malformedMessage="The saved override is malformed. Choose a valid value and save to replace it."
					modelConfigsError={modelConfigsError}
				>
					{isInvalidRootDeploymentDefault && (
						<Alert severity="warning">
							<AlertDescription>
								The saved root override uses the deployment default, which is
								not supported for root agents. Choose a valid value and save to
								replace it.
							</AlertDescription>
						</Alert>
					)}
				</ModelOverrideAlerts>
				<div className="flex justify-end">
					<Button
						size="sm"
						type="submit"
						disabled={isFormDisabled || !canSaveSelection}
					>
						Save
					</Button>
				</div>
				{isSaveError && (
					<p className="m-0 text-xs text-content-destructive">
						{saveErrorMessage}
					</p>
				)}
			</form>
		</section>
	);
};
