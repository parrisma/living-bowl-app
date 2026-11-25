import { StatusBar } from 'expo-status-bar';
import Slider from '@react-native-community/slider';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  type HostInstance,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppLocale } from '../../localization/LocalizationProvider';
import { useAppPreferences } from '../../preferences/AppPreferencesProvider';
import { CompactDropdown, type DropdownOption } from '../../shared/ui/CompactDropdown';
import type { LocaleChoice } from '../../localization/locale';
import { getResponsiveTokens } from '../../theme/responsive';
import { useTheme } from '../../theme/ThemeProvider';
import type { ThemeChoice } from '../../theme/registry';
import type { ThemeDefinition } from '../../theme/types';
import type { TFunction } from 'i18next';
import {
  cloneDeviceControlConfig,
  countChangedGroups,
  DEFAULT_DEVICE_CONTROL_CONFIG,
  MOCK_BOUNDS,
  PUMP_IDS,
  type DeviceControlConfig,
  type PumpId,
} from './device-control';
import { createInitialMockTelemetry, mockApplyControls, MockValidationError, type MockTelemetry } from './mock-controls';

type DetailsResource =
  | { kind: 'pump'; id: PumpId }
  | { kind: 'mist' }
  | { kind: 'led' }
  | { kind: 'automation' };

const themeOptions: readonly { choice: ThemeChoice; label: string }[] = [
  { choice: 'system', label: 'themeSystem' },
  { choice: 'light', label: 'themeLight' },
  { choice: 'dark', label: 'themeDark' },
  { choice: 'neon', label: 'themeNeon' },
];

const themeLabels: Record<ThemeChoice, string> = {
  system: 'themeSystem',
  light: 'themeLight',
  dark: 'themeDark',
  neon: 'themeNeon',
};

const languageLabels: Record<LocaleChoice, string> = {
  system: 'languageSystem',
  en: 'languageEnglish',
  fr: 'languageFrench',
  'zh-Hans': 'languageChinese',
  ja: 'languageJapanese',
};

const languageOptions: readonly { choice: LocaleChoice; label: string }[] = [
  { choice: 'system', label: 'languageSystem' },
  { choice: 'en', label: 'languageEnglish' },
  { choice: 'fr', label: 'languageFrench' },
  { choice: 'zh-Hans', label: 'languageChinese' },
  { choice: 'ja', label: 'languageJapanese' },
];

export default function DeviceControlScreen() {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const locale = useAppLocale();
  const { t } = useTranslation();
  const { themeChoice, localeChoice, isReady, hasError, setThemeChoice, setLocaleChoice } = useAppPreferences();
  const [acceptedConfig, setAcceptedConfig] = useState(() => cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG));
  const [draftConfig, setDraftConfig] = useState(() => cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG));
  const [telemetry, setTelemetry] = useState<MockTelemetry>(createInitialMockTelemetry);
  const [selectedDetails, setSelectedDetails] = useState<DetailsResource | null>(null);
  const [openDropdown, setOpenDropdown] = useState<'theme' | 'language' | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const [sliderEpoch, setSliderEpoch] = useState(0);
  const detailsButtons = useRef<Record<string, HostInstance | null>>({});
  const focusAfterDetails = useRef<DetailsResource | null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responsive = getResponsiveTokens(width);
  const changedCount = countChangedGroups(draftConfig, acceptedConfig);
  const overrideCount =
    PUMP_IDS.filter((pumpId) => draftConfig.pumps[pumpId].overrideEnabled).length +
    Number(draftConfig.mist.overrideEnabled) +
    Number(draftConfig.led.overrideEnabled);
  const languageCode = locale.slice(0, 2).toUpperCase();
  const selectedThemeLabel = t(themeLabels[themeChoice]);
  const translatedThemeOptions: DropdownOption<ThemeChoice>[] = themeOptions.map(({ choice, label }) => ({
    value: choice,
    label: t(label),
  }));
  const translatedLanguageOptions: DropdownOption<LocaleChoice>[] = languageOptions.map(({ choice, label }) => ({
    value: choice,
    label:
      choice === 'system'
        ? `${t(label)} (${languageCode})`
        : `${t(label)} (${choice.slice(0, 2).toUpperCase()})`,
  }));

  useEffect(
    () => () => {
      if (focusTimer.current !== null) {
        clearTimeout(focusTimer.current);
      }
    },
    [],
  );

  function updateDraft(updater: (current: DeviceControlConfig) => DeviceControlConfig) {
    setDraftConfig(updater);
    setErrorKey(null);
  }

  function setPumpOverride(pumpId: PumpId, enabled: boolean) {
    updateDraft((current) => ({
      ...current,
      pumps: {
        ...current.pumps,
        [pumpId]: {
          ...current.pumps[pumpId],
          overrideEnabled: enabled,
          ...(enabled && !current.pumps[pumpId].overrideEnabled
            ? { manualFlow: telemetry.pumps[pumpId].currentFlow }
            : {}),
        },
      },
    }));
    setSliderEpoch((epoch) => epoch + 1);
  }

  function setMistOverride(enabled: boolean) {
    updateDraft((current) => ({
      ...current,
      mist: {
        ...current.mist,
        overrideEnabled: enabled,
        ...(enabled && !current.mist.overrideEnabled ? { manualLevel: telemetry.mist.level } : {}),
      },
    }));
    setSliderEpoch((epoch) => epoch + 1);
  }

  function setLedOverride(enabled: boolean) {
    updateDraft((current) => ({
      ...current,
      led: {
        ...current.led,
        overrideEnabled: enabled,
        ...(enabled && !current.led.overrideEnabled
          ? { manualBrightness: telemetry.led.currentBrightness }
          : {}),
      },
    }));
    setSliderEpoch((epoch) => epoch + 1);
  }

  async function applyChanges() {
    if (isPending || changedCount === 0) {
      return;
    }

    setIsPending(true);
    setErrorKey(null);
    try {
      const result = await mockApplyControls(draftConfig, telemetry);
      setAcceptedConfig(result.acceptedConfig);
      setDraftConfig(cloneDeviceControlConfig(result.acceptedConfig));
      setTelemetry(result.telemetry);
      setSliderEpoch((epoch) => epoch + 1);
      setIsConfirmingDiscard(false);
    } catch (error) {
      setErrorKey(error instanceof MockValidationError ? 'invalidConfig' : 'applyError');
    } finally {
      setIsPending(false);
    }
  }

  function discardChanges() {
    setDraftConfig(cloneDeviceControlConfig(acceptedConfig));
    setSliderEpoch((epoch) => epoch + 1);
    setErrorKey(null);
    setIsConfirmingDiscard(false);
  }

  function openDetails(resource: DetailsResource) {
    setSelectedDetails(resource);
  }

  function closeDetails(resource: DetailsResource) {
    focusAfterDetails.current = resource;
    setSelectedDetails(null);
    if (focusTimer.current !== null) {
      clearTimeout(focusTimer.current);
    }
    focusTimer.current = setTimeout(restoreDetailsFocus, 350);
  }

  function restoreDetailsFocus() {
    const resource = focusAfterDetails.current;
    if (resource === null) {
      return;
    }
    focusAfterDetails.current = null;
    if (focusTimer.current !== null) {
      clearTimeout(focusTimer.current);
      focusTimer.current = null;
    }
    if (Platform.OS === 'web') {
      detailsButtons.current[resourceKey(resource)]?.focus();
      return;
    }
    requestAnimationFrame(() => {
      const tag = findNodeHandle(detailsButtons.current[resourceKey(resource)] ?? null);
      if (tag !== null && tag !== undefined) {
        AccessibilityInfo.setAccessibilityFocus(tag);
      }
    });
  }

  const topControls = (
    <View
      style={[
        styles.topControls,
        { columnGap: theme.spacing.choiceGap, marginBottom: theme.spacing.titleGap },
      ]}
    >
      <CompactDropdown
        accessibilityLabel={`${t('themeSetting')}: ${selectedThemeLabel}`}
        disabled={!isReady}
        expanded={openDropdown === 'theme'}
        minTouchHeight={responsive.choiceMinHeight}
        onClose={() => setOpenDropdown(null)}
        onSelect={(choice) => void setThemeChoice(choice)}
        onToggle={() => setOpenDropdown(openDropdown === 'theme' ? null : 'theme')}
        options={translatedThemeOptions}
        selectedLabel={selectedThemeLabel}
        title={t('themeSetting')}
        theme={theme}
        value={themeChoice}
      />
      <CompactDropdown
        accessibilityLabel={`${t('languageSetting')}: ${t(languageLabels[localeChoice])} (${languageCode})`}
        disabled={!isReady}
        expanded={openDropdown === 'language'}
        minTouchHeight={responsive.choiceMinHeight}
        onClose={() => setOpenDropdown(null)}
        onSelect={(choice) => void setLocaleChoice(choice)}
        onToggle={() => setOpenDropdown(openDropdown === 'language' ? null : 'language')}
        options={translatedLanguageOptions}
        selectedLabel={languageCode}
        title={t('languageSetting')}
        theme={theme}
        value={localeChoice}
      />
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.screen}>
        {openDropdown ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('closeDropdown')}
            onPress={() => setOpenDropdown(null)}
            style={styles.dismissOverlay}
          />
        ) : null}
        <View
          style={[
            styles.fixedControls,
            { paddingHorizontal: responsive.screenHorizontal, paddingTop: responsive.screenVertical },
          ]}
        >
          <View style={{ maxWidth: responsive.contentMaxWidth, width: '100%' }}>{topControls}</View>
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: responsive.screenHorizontal,
              paddingTop: responsive.screenVertical,
              paddingBottom: theme.spacing.card,
            },
          ]}
        >
          <View style={{ maxWidth: responsive.contentMaxWidth, width: '100%' }}>
            <Text
              style={[
                theme.typography.title,
                styles.title,
                { color: theme.colors.text, fontSize: Math.round(theme.typography.title.fontSize * responsive.titleScale) },
              ]}
            >
              {t('dashboardTitle')}
            </Text>
            <View style={styles.statusRow}>
              <Text
                accessibilityRole="text"
                style={[
                  theme.typography.label,
                  styles.simulatedBadge,
                  { color: theme.colors.accent, borderColor: theme.colors.accent },
                ]}
              >
                {t('simulated')}
              </Text>
              <Text style={[theme.typography.label, { color: theme.colors.secondaryText }]}>
                {t('overridesActive', { count: overrideCount })}
              </Text>
            </View>
            <Text
              accessibilityLiveRegion="polite"
              style={[theme.typography.body, styles.description, { color: theme.colors.secondaryText }]}
            >
              {t('simulatedNote')}
            </Text>
            {hasError ? (
              <Text accessibilityRole="alert" style={[theme.typography.label, { color: theme.colors.secondaryText }]}>
                {t('settingsError')}
              </Text>
            ) : null}
            {errorKey ? (
              <Text accessibilityRole="alert" style={[theme.typography.label, { color: theme.colors.secondaryText }]}>
                {t(errorKey)}
              </Text>
            ) : null}
            <View style={styles.cards}>
              {PUMP_IDS.map((pumpId) => {
                const name = t('pumpTitle', { number: pumpId });
                const settings = draftConfig.pumps[pumpId];
                const live = telemetry.pumps[pumpId];
                const sliderValue = settings.manualFlow;
                return (
                  <ResourceCard
                    key={`pump-${pumpId}`}
                    name={name}
                    mode={settings.overrideEnabled ? 'override' : 'auto'}
                    currentValue={live.currentFlow}
                    targetValue={sliderValue}
                    min={MOCK_BOUNDS.flow.min}
                    max={MOCK_BOUNDS.flow.max}
                    step={0.1}
                    unit="L/min"
                    displayCurrent={(value) => `${formatNumber(value, locale)} L/min`}
                    displayTarget={(value) => `${formatNumber(value, locale)} L/min`}
                    sliderValue={sliderValue}
                    sliderEpoch={sliderEpoch}
                    testID={`pump-${pumpId}-slider`}
                    detailsLabel={t('detailsLabel', { resource: name })}
                    detailsRef={(node) => {
                      detailsButtons.current[`pump-${pumpId}`] = node;
                    }}
                    onModeChange={(enabled) => setPumpOverride(pumpId, enabled)}
                    onSliderChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        pumps: {
                          ...current.pumps,
                          [pumpId]: { ...current.pumps[pumpId], manualFlow: round(value, 1) },
                        },
                      }))
                    }
                    onDetails={() => openDetails({ kind: 'pump', id: pumpId })}
                    theme={theme}
                    t={t}
                    disabled={isPending}
                  >
                    <Text style={[theme.typography.label, { color: theme.colors.secondaryText }]}>
                      {t('phase')}: {t(live.phase)}
                    </Text>
                  </ResourceCard>
                );
              })}
              <ResourceCard
                name={t('mistTitle')}
                mode={draftConfig.mist.overrideEnabled ? 'override' : 'auto'}
                currentValue={telemetry.mist.level}
                targetValue={draftConfig.mist.manualLevel}
                min={MOCK_BOUNDS.mistLevel.min}
                max={MOCK_BOUNDS.mistLevel.max}
                step={0.1}
                unit={t('levelUnit')}
                displayCurrent={(value) => `${formatNumber(value, locale)} / 10`}
                displayTarget={(value) => `${formatNumber(value, locale)} / 10`}
                sliderValue={draftConfig.mist.manualLevel}
                sliderEpoch={sliderEpoch}
                testID="mist-slider"
                detailsLabel={t('detailsLabel', { resource: t('mistTitle') })}
                detailsRef={(node) => {
                  detailsButtons.current.mist = node;
                }}
                onModeChange={setMistOverride}
                onSliderChange={(value) =>
                  updateDraft((current) => ({
                    ...current,
                    mist: { ...current.mist, manualLevel: round(value, 1) },
                  }))
                }
                onDetails={() => openDetails({ kind: 'mist' })}
                theme={theme}
                t={t}
                disabled={isPending}
              >
                <Text style={[theme.typography.label, { color: theme.colors.secondaryText }]}>
                  {t('burstState')}: {telemetry.mist.burstOn ? t('burstOn') : t('burstOff')}
                </Text>
              </ResourceCard>
              <ResourceCard
                name={t('ledTitle')}
                mode={draftConfig.led.overrideEnabled ? 'override' : 'auto'}
                currentValue={(telemetry.led.currentBrightness / MOCK_BOUNDS.brightness.max) * 100}
                targetValue={(draftConfig.led.manualBrightness / MOCK_BOUNDS.brightness.max) * 100}
                min={0}
                max={100}
                step={1}
                unit="%"
                displayCurrent={(value) => `${formatNumber(value, locale, 0)}%`}
                displayTarget={(value) => `${formatNumber(value, locale, 0)}%`}
                sliderValue={(draftConfig.led.manualBrightness / MOCK_BOUNDS.brightness.max) * 100}
                sliderMin={0}
                sliderMax={100}
                sliderStep={1}
                sliderEpoch={sliderEpoch}
                testID="led-slider"
                detailsLabel={t('detailsLabel', { resource: t('ledTitle') })}
                detailsRef={(node) => {
                  detailsButtons.current.led = node;
                }}
                onModeChange={setLedOverride}
                onSliderChange={(value) =>
                  updateDraft((current) => ({
                    ...current,
                    led: {
                      ...current.led,
                      manualBrightness: Math.round((value / 100) * MOCK_BOUNDS.brightness.max),
                    },
                  }))
                }
                onDetails={() => openDetails({ kind: 'led' })}
                theme={theme}
                t={t}
                disabled={isPending}
              >
                <Text style={[theme.typography.label, { color: theme.colors.secondaryText }]}>
                  {t('targetBrightness')}: {formatNumber((telemetry.led.targetBrightness / 255) * 100, locale, 0)}%
                </Text>
              </ResourceCard>
            </View>
            <View
              style={[
                styles.automationCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.shape.cardRadius,
                  borderWidth: theme.shape.borderWidth,
                  padding: theme.spacing.card,
                },
              ]}
            >
              <Text style={[theme.typography.label, { color: theme.colors.text }]}>{t('automationTitle')}</Text>
              <Text style={[theme.typography.body, { color: theme.colors.secondaryText }]}>
                {t('progress')}: {formatNumber(telemetry.evolution.progress * 100, locale, 0)}%
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('detailsLabel', { resource: t('automationTitle') })}
                disabled={isPending}
                onPress={() => openDetails({ kind: 'automation' })}
                style={({ pressed }) => buttonStyle(theme, responsive.buttonMinHeight, pressed, isPending)}
              >
                <Text style={[theme.typography.button, { color: theme.colors.onPrimary }]}>{t('viewDetails')}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
        <ActionsBar
          theme={theme}
          t={t}
          changedCount={changedCount}
          pending={isPending}
          confirmingDiscard={isConfirmingDiscard}
          onApply={() => void applyChanges()}
          onRequestDiscard={() => setIsConfirmingDiscard(true)}
          onConfirmDiscard={discardChanges}
          onCancelDiscard={() => setIsConfirmingDiscard(false)}
        />
        <Modal
          visible={selectedDetails !== null}
          animationType="slide"
          presentationStyle="fullScreen"
          onDismiss={restoreDetailsFocus}
          onRequestClose={() => {
            if (selectedDetails) {
              closeDetails(selectedDetails);
            }
          }}
        >
          {selectedDetails ? (
            <DetailsModal
              resource={selectedDetails}
              config={draftConfig}
              telemetry={telemetry}
              updateDraft={updateDraft}
              onOutputSettingChange={() => setSliderEpoch((epoch) => epoch + 1)}
              onClose={() => closeDetails(selectedDetails)}
              theme={theme}
              responsive={responsive}
              locale={locale}
              t={t}
              disabled={isPending}
            >
              <ActionsBar
                theme={theme}
                t={t}
                changedCount={changedCount}
                pending={isPending}
                confirmingDiscard={isConfirmingDiscard}
                onApply={() => void applyChanges()}
                onRequestDiscard={() => setIsConfirmingDiscard(true)}
                onConfirmDiscard={discardChanges}
                onCancelDiscard={() => setIsConfirmingDiscard(false)}
              />
            </DetailsModal>
          ) : null}
        </Modal>
      </View>
      <StatusBar style={theme.statusBarStyle} />
    </SafeAreaView>
  );
}

type Translate = TFunction;

type ResourceCardProps = {
  name: string;
  mode: 'auto' | 'override';
  currentValue: number;
  targetValue: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  displayCurrent: (value: number) => string;
  displayTarget: (value: number) => string;
  sliderValue: number;
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  sliderEpoch: number;
  testID: string;
  detailsLabel: string;
  detailsRef: (node: HostInstance | null) => void;
  onModeChange: (enabled: boolean) => void;
  onSliderChange: (value: number) => void;
  onDetails: () => void;
  theme: ThemeDefinition;
  t: Translate;
  disabled: boolean;
  children: React.ReactNode;
};

function ResourceCard({
  name,
  mode,
  currentValue,
  targetValue,
  min,
  max,
  step,
  unit,
  displayCurrent,
  displayTarget,
  sliderValue,
  sliderMin = min,
  sliderMax = max,
  sliderStep = step,
  sliderEpoch,
  testID,
  detailsLabel,
  detailsRef,
  onModeChange,
  onSliderChange,
  onDetails,
  theme,
  t,
  disabled,
  children,
}: ResourceCardProps) {
  const meterText = t('resourceMeterValue', {
    resource: name,
    value: displayCurrent(currentValue),
    min,
    max,
    unit,
  });
  const sliderLabel = t('resourceSliderLabel', {
    resource: name,
    value: displayTarget(targetValue),
    min,
    max,
    unit,
  });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.shape.cardRadius,
          borderWidth: theme.shape.borderWidth,
          padding: theme.spacing.card,
        },
      ]}
    >
      <Text style={[theme.typography.title, styles.cardTitle, { color: theme.colors.text }]}>{name}</Text>
      <ModeSelector mode={mode} name={name} onChange={onModeChange} theme={theme} t={t} disabled={disabled} />
      <View style={styles.values}>
        <ValueSummary label={t('currentValue')} value={displayCurrent(currentValue)} theme={theme} />
        {mode === 'override' ? (
          <ValueSummary label={t('draftTarget')} value={displayTarget(targetValue)} theme={theme} />
        ) : null}
      </View>
      {mode === 'auto' ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('resourceAutoLabel', { resource: name })}
          accessibilityValue={{ min, max, now: currentValue, text: meterText }}
          style={[styles.meterTrack, { backgroundColor: theme.colors.border }]}
        >
          <View
            style={[
              styles.meterFill,
              {
                backgroundColor: theme.colors.primary,
                width: `${Math.min(100, Math.max(0, (currentValue / max) * 100))}%`,
              },
            ]}
          />
        </View>
      ) : (
        <Slider
          key={`${testID}-${sliderEpoch}`}
          accessibilityLabel={sliderLabel}
          accessibilityRole="adjustable"
          accessibilityValue={{
            min: sliderMin,
            max: sliderMax,
            now: sliderValue,
            text: t('resourceMeterValue', {
              resource: name,
              value: displayTarget(targetValue),
              min,
              max,
              unit,
            }),
          }}
          disabled={disabled}
          maximumTrackTintColor={theme.colors.border}
          maximumValue={sliderMax}
          minimumTrackTintColor={theme.colors.primary}
          minimumValue={sliderMin}
          onValueChange={onSliderChange}
          step={sliderStep}
          style={styles.slider}
          testID={testID}
          thumbTintColor={theme.colors.accent}
          value={sliderValue}
        />
      )}
      <View style={styles.statusText}>{children}</View>
      <Pressable
        ref={detailsRef}
        accessibilityRole="button"
        accessibilityLabel={detailsLabel}
        disabled={disabled}
        onPress={onDetails}
        style={({ pressed }) => buttonStyle(theme, 44, pressed, disabled)}
      >
        <Text style={[theme.typography.button, { color: theme.colors.onPrimary }]}>{t('viewDetails')}</Text>
      </Pressable>
    </View>
  );
}

function ModeSelector({
  mode,
  name,
  onChange,
  theme,
  t,
  disabled,
}: {
  mode: 'auto' | 'override';
  name: string;
  onChange: (enabled: boolean) => void;
  theme: ThemeDefinition;
  t: Translate;
  disabled: boolean;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('modeGroup', { resource: name })} style={styles.modeGroup}>
      {(['auto', 'override'] as const).map((option) => {
        const selected = mode === option;
        const label = t(option);
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={t('modeOption', { resource: name, mode: label })}
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option === 'override')}
            style={({ pressed }) => [
              styles.modeOption,
              {
                backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                borderRadius: theme.shape.choiceRadius,
                borderWidth: theme.shape.borderWidth,
                minHeight: 44,
                opacity: pressed ? theme.interaction.pressedOpacity : disabled ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[theme.typography.label, { color: selected ? theme.colors.onPrimary : theme.colors.text }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ValueSummary({ label, value, theme }: { label: string; value: string; theme: ThemeDefinition }) {
  return (
    <View style={styles.valueSummary}>
      <Text style={[theme.typography.label, { color: theme.colors.secondaryText }]}>{label}</Text>
      <Text style={[theme.typography.result, styles.valueText, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

function ActionsBar({
  theme,
  t,
  changedCount,
  pending,
  confirmingDiscard,
  onApply,
  onRequestDiscard,
  onConfirmDiscard,
  onCancelDiscard,
}: {
  theme: ThemeDefinition;
  t: Translate;
  changedCount: number;
  pending: boolean;
  confirmingDiscard: boolean;
  onApply: () => void;
  onRequestDiscard: () => void;
  onConfirmDiscard: () => void;
  onCancelDiscard: () => void;
}) {
  return (
    <View style={[styles.actionsBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      {confirmingDiscard ? (
        <View style={styles.discardConfirmation}>
          <Text accessibilityRole="alert" style={[theme.typography.label, { color: theme.colors.text }]}>
            {t('discardChangesMessage')}
          </Text>
          <View style={styles.actionButtons}>
            <ActionButton
              label={t('keepEditing')}
              onPress={onCancelDiscard}
              theme={theme}
              minHeight={44}
              secondary
            />
            <ActionButton
              label={t('confirmDiscard')}
              onPress={onConfirmDiscard}
              theme={theme}
              minHeight={44}
            />
          </View>
        </View>
      ) : (
        <>
          <Text accessibilityLiveRegion="polite" style={[theme.typography.label, { color: theme.colors.text }]}>
            {pending ? t('applying') : t('unsavedCount', { count: changedCount })}
          </Text>
          <View style={styles.actionButtons}>
            <ActionButton
              label={t('discardChanges')}
              onPress={onRequestDiscard}
              theme={theme}
              minHeight={44}
              secondary
              disabled={pending || changedCount === 0}
            />
            <ActionButton
              label={pending ? t('applying') : t('applyChanges')}
              onPress={onApply}
              theme={theme}
              minHeight={44}
              disabled={pending || changedCount === 0}
            />
          </View>
        </>
      )}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  theme,
  minHeight,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  theme: ThemeDefinition;
  minHeight: number;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: secondary ? theme.colors.surface : theme.colors.primary,
          borderColor: theme.colors.border,
          borderRadius: theme.shape.buttonRadius,
          borderWidth: secondary ? theme.shape.borderWidth : 0,
          minHeight,
          opacity: pressed ? theme.interaction.pressedOpacity : disabled ? 0.55 : 1,
          paddingHorizontal: theme.spacing.buttonHorizontal / 2,
          paddingVertical: theme.spacing.buttonVertical / 2,
        },
      ]}
    >
      <Text style={[theme.typography.button, { color: secondary ? theme.colors.text : theme.colors.onPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function DetailsModal({
  resource,
  config,
  telemetry,
  updateDraft,
  onOutputSettingChange,
  onClose,
  theme,
  responsive,
  locale,
  t,
  disabled,
  children,
}: {
  resource: DetailsResource;
  config: DeviceControlConfig;
  telemetry: MockTelemetry;
  updateDraft: (updater: (current: DeviceControlConfig) => DeviceControlConfig) => void;
  onOutputSettingChange: () => void;
  onClose: () => void;
  theme: ThemeDefinition;
  responsive: ReturnType<typeof getResponsiveTokens>;
  locale: string;
  t: Translate;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const title = getDetailsTitle(resource, t);
  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.modal, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.modalHeader, { borderColor: theme.colors.border, paddingHorizontal: responsive.screenHorizontal }]}>
        <Text style={[theme.typography.title, styles.modalTitle, { color: theme.colors.text }]}>{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('closeDetails')}
          onPress={onClose}
          style={({ pressed }) => buttonStyle(theme, 44, pressed, false)}
        >
          <Text style={[theme.typography.button, { color: theme.colors.onPrimary }]}>{t('close')}</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.detailsContent,
          { paddingHorizontal: responsive.screenHorizontal, paddingVertical: theme.spacing.card },
        ]}
      >
        <View style={{ maxWidth: responsive.contentMaxWidth, width: '100%' }}>
          <Text style={[theme.typography.label, styles.sectionTitle, { color: theme.colors.text }]}>{t('liveSection')}</Text>
          {resource.kind === 'pump' ? (
            <PumpDetails
              pumpId={resource.id}
              config={config}
              telemetry={telemetry}
              theme={theme}
              locale={locale}
              t={t}
            />
          ) : null}
          {resource.kind === 'mist' ? (
            <MistDetails
              config={config}
              telemetry={telemetry}
              theme={theme}
              locale={locale}
              t={t}
            />
          ) : null}
          {resource.kind === 'led' ? (
            <LedDetails
              config={config}
              telemetry={telemetry}
              theme={theme}
              locale={locale}
              t={t}
            />
          ) : null}
          {resource.kind === 'automation' ? (
            <AutomationDetails
              config={config}
              telemetry={telemetry}
              theme={theme}
              locale={locale}
              t={t}
            />
          ) : null}
          <Text style={[theme.typography.label, styles.sectionTitle, { color: theme.colors.text }]}>
          {t('settingsSection')}
          </Text>
          {resource.kind === 'pump' ? (
            <PumpSettings
              pumpId={resource.id}
              config={config}
              updateDraft={updateDraft}
              theme={theme}
              locale={locale}
              t={t}
              disabled={disabled}
            />
          ) : null}
          {resource.kind === 'mist' ? (
            <MistSettings
              config={config}
              updateDraft={updateDraft}
              onOutputSettingChange={onOutputSettingChange}
              theme={theme}
              locale={locale}
              t={t}
              disabled={disabled}
            />
          ) : null}
          {resource.kind === 'led' ? (
            <LedSettings
              config={config}
              updateDraft={updateDraft}
              onOutputSettingChange={onOutputSettingChange}
              theme={theme}
              locale={locale}
              t={t}
              disabled={disabled}
            />
          ) : null}
          {resource.kind === 'automation' ? (
            <AutomationSettings
              config={config}
              updateDraft={updateDraft}
              theme={theme}
              locale={locale}
              t={t}
              disabled={disabled}
            />
          ) : null}
        </View>
      </ScrollView>
      {children}
    </SafeAreaView>
  );
}

function PumpDetails({
  pumpId,
  config,
  telemetry,
  theme,
  locale,
  t,
}: DetailContext & { pumpId: PumpId }) {
  const live = telemetry.pumps[pumpId];
  return (
    <StatsCard theme={theme}>
      <StatRow label={t('phase')} value={t(live.phase)} theme={theme} />
      <StatRow label={t('currentFlow')} value={`${formatNumber(live.currentFlow, locale)} L/min`} theme={theme} />
      <StatRow label={t('currentPwm')} value={`${live.currentPwm} / 255 PWM`} theme={theme} />
      <StatRow
        label={t('evolutionProgress')}
        value={`${formatNumber(telemetry.evolution.progress * 100, locale, 0)}%`}
        theme={theme}
      />
      <StatRow label={t('profileTargetFlow')} value={`${formatNumber(live.profileTargetFlow, locale)} L/min`} theme={theme} />
      <StatRow label={t('onDurationTarget')} value={`${formatNumber(live.onDurationTargetMs / 1000, locale)} s`} theme={theme} />
      <StatRow label={t('offDurationTarget')} value={`${formatNumber(live.offDurationTargetMs / 1000, locale)} s`} theme={theme} />
      <StatRow
        label={t('currentOverrideMode')}
        value={config.pumps[pumpId].overrideEnabled ? t('override') : t('auto')}
        theme={theme}
      />
    </StatsCard>
  );
}

function MistDetails({ config, telemetry, theme, locale, t }: DetailContext) {
  return (
    <StatsCard theme={theme}>
      <StatRow label={t('currentLevel')} value={`${formatNumber(telemetry.mist.level, locale)} / 10`} theme={theme} />
      <StatRow label={t('dynamicCap')} value={`${formatNumber(telemetry.mist.dynamicCap, locale)} / 10`} theme={theme} />
      <StatRow
        label={t('averagePumpActivity')}
        value={`${formatNumber(telemetry.averagePumpActivity * 100, locale, 0)}%`}
        theme={theme}
      />
      <StatRow label={t('burstState')} value={telemetry.mist.burstOn ? t('burstOn') : t('burstOff')} theme={theme} />
      <StatRow
        label={t('currentOverrideMode')}
        value={config.mist.overrideEnabled ? t('override') : t('auto')}
        theme={theme}
      />
    </StatsCard>
  );
}

function LedDetails({ config, telemetry, theme, locale, t }: DetailContext) {
  return (
    <StatsCard theme={theme}>
      <StatRow
        label={t('currentBrightness')}
        value={formatBrightness(telemetry.led.currentBrightness, locale)}
        theme={theme}
      />
      <StatRow
        label={t('averagePumpActivity')}
        value={`${formatNumber(telemetry.averagePumpActivity * 100, locale, 0)}%`}
        theme={theme}
      />
      <StatRow
        label={t('activityContribution')}
        value={`${formatNumber(telemetry.led.activityContribution * 100, locale, 0)}%`}
        theme={theme}
      />
      <StatRow
        label={t('mistContribution')}
        value={`${formatNumber(telemetry.led.mistContribution * 100, locale, 0)}%`}
        theme={theme}
      />
      <StatRow
        label={t('targetBrightness')}
        value={formatBrightness(telemetry.led.targetBrightness, locale)}
        theme={theme}
      />
      <StatRow
        label={t('currentOverrideMode')}
        value={config.led.overrideEnabled ? t('override') : t('auto')}
        theme={theme}
      />
    </StatsCard>
  );
}

function AutomationDetails({ config, telemetry, theme, locale, t }: DetailContext) {
  return (
    <>
      <StatsCard theme={theme}>
        <StatRow
          label={t('cycleProgress')}
          value={`${formatNumber(telemetry.evolution.progress * 100, locale, 0)}%`}
          theme={theme}
        />
        <StatRow label={t('cycleElapsed')} value={formatDuration(telemetry.evolution.elapsedMs, locale)} theme={theme} />
        <StatRow label={t('cycleDuration')} value={formatDuration(config.evolutionCycleMs, locale)} theme={theme} />
        <StatRow
          label={t('targetBlendFactor')}
          value={formatNumber(config.evolutionBlendFactor, locale, 2)}
          theme={theme}
        />
      </StatsCard>
      <Text style={[theme.typography.label, styles.sectionTitle, { color: theme.colors.text }]}>
        {t('profileTargets')}
      </Text>
      <StatsCard theme={theme}>
        {PUMP_IDS.map((pumpId) => (
          <StatRow
            key={pumpId}
            label={t('pumpTitle', { number: pumpId })}
            value={`${formatNumber(telemetry.pumps[pumpId].profileTargetFlow, locale)} L/min`}
            theme={theme}
          />
        ))}
      </StatsCard>
    </>
  );
}

type DetailContext = {
  config: DeviceControlConfig;
  telemetry: MockTelemetry;
  theme: ThemeDefinition;
  locale: string;
  t: Translate;
};

type SettingsContext = {
  config: DeviceControlConfig;
  updateDraft: (updater: (current: DeviceControlConfig) => DeviceControlConfig) => void;
  onOutputSettingChange?: () => void;
  theme: ThemeDefinition;
  locale: string;
  t: Translate;
  disabled: boolean;
};

function PumpSettings({
  pumpId,
  config,
  updateDraft,
  theme,
  locale,
  t,
  disabled,
}: SettingsContext & { pumpId: PumpId }) {
  const pump = config.pumps[pumpId];
  function update(patch: Partial<DeviceControlConfig['pumps'][PumpId]>) {
    updateDraft((current) => ({
      ...current,
      pumps: { ...current.pumps, [pumpId]: { ...current.pumps[pumpId], ...patch } },
    }));
  }

  return (
    <View style={styles.settings}>
      <NumberStepper
        label={t('minFlow')}
        value={pump.minFlow}
        min={MOCK_BOUNDS.flow.min}
        max={pump.maxFlow}
        step={0.1}
        unit="L/min"
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ minFlow: value })}
      />
      <NumberStepper
        label={t('maxFlow')}
        value={pump.maxFlow}
        min={pump.minFlow}
        max={MOCK_BOUNDS.flow.max}
        step={0.1}
        unit="L/min"
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ maxFlow: value })}
      />
      <DurationStepper
        label={t('onDurationMin')}
        value={pump.onDurationMinMs}
        min={MOCK_BOUNDS.durationMs.min}
        max={pump.onDurationMaxMs}
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ onDurationMinMs: value })}
      />
      <DurationStepper
        label={t('onDurationMax')}
        value={pump.onDurationMaxMs}
        min={pump.onDurationMinMs}
        max={MOCK_BOUNDS.durationMs.max}
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ onDurationMaxMs: value })}
      />
      <DurationStepper
        label={t('offDurationMin')}
        value={pump.offDurationMinMs}
        min={MOCK_BOUNDS.durationMs.min}
        max={pump.offDurationMaxMs}
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ offDurationMinMs: value })}
      />
      <DurationStepper
        label={t('offDurationMax')}
        value={pump.offDurationMaxMs}
        min={pump.offDurationMinMs}
        max={MOCK_BOUNDS.durationMs.max}
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ offDurationMaxMs: value })}
      />
      <DurationStepper
        label={t('rampDuration')}
        value={pump.rampMs}
        min={MOCK_BOUNDS.rampMs.min}
        max={MOCK_BOUNDS.rampMs.max}
        stepMs={100}
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ rampMs: value })}
      />
      <NumberStepper
        label={t('activePwmFloor')}
        value={pump.activePwmFloor}
        min={MOCK_BOUNDS.pwm.min}
        max={MOCK_BOUNDS.pwm.max}
        step={1}
        unit="PWM"
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ activePwmFloor: value })}
      />
    </View>
  );
}

function MistSettings({
  config,
  updateDraft,
  onOutputSettingChange,
  theme,
  locale,
  t,
  disabled,
}: SettingsContext) {
  function update(patch: Partial<DeviceControlConfig['mist']>, output = false) {
    updateDraft((current) => ({ ...current, mist: { ...current.mist, ...patch } }));
    if (output) {
      onOutputSettingChange?.();
    }
  }

  return (
    <View style={styles.settings}>
      <NumberStepper
        label={t('manualLevel')}
        value={config.mist.manualLevel}
        min={MOCK_BOUNDS.mistLevel.min}
        max={MOCK_BOUNDS.mistLevel.max}
        step={0.1}
        unit="/ 10"
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ manualLevel: value }, true)}
      />
      <DurationStepper
        label={t('burstPeriod')}
        value={config.mist.burstPeriodMs}
        min={MOCK_BOUNDS.burstPeriodMs.min}
        max={MOCK_BOUNDS.burstPeriodMs.max}
        stepMs={100}
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ burstPeriodMs: value })}
      />
      <DurationStepper
        label={t('rampDuration')}
        value={config.mist.rampMs}
        min={MOCK_BOUNDS.rampMs.min}
        max={MOCK_BOUNDS.rampMs.max}
        stepMs={100}
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ rampMs: value })}
      />
      <DurationStepper
        label={t('holdDuration')}
        value={config.mist.holdMs}
        min={MOCK_BOUNDS.durationMs.min}
        max={MOCK_BOUNDS.durationMs.max}
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ holdMs: value })}
      />
      <DurationStepper
        label={t('fadeDuration')}
        value={config.mist.fadeMs}
        min={MOCK_BOUNDS.durationMs.min}
        max={MOCK_BOUNDS.durationMs.max}
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ fadeMs: value })}
      />
    </View>
  );
}

function LedSettings({
  config,
  updateDraft,
  onOutputSettingChange,
  theme,
  locale,
  t,
  disabled,
}: SettingsContext) {
  function update(patch: Partial<DeviceControlConfig['led']>, output = false) {
    updateDraft((current) => ({ ...current, led: { ...current.led, ...patch } }));
    if (output) {
      onOutputSettingChange?.();
    }
  }

  return (
    <View style={styles.settings}>
      <NumberStepper
        label={t('manualBrightness')}
        value={config.led.manualBrightness}
        min={MOCK_BOUNDS.brightness.min}
        max={MOCK_BOUNDS.brightness.max}
        step={1}
        unit="PWM"
        formatValue={(value) => `${formatNumber(value, locale, 0)} PWM (${formatNumber((value / 255) * 100, locale, 0)}%)`}
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ manualBrightness: value }, true)}
      />
      <NumberStepper
        label={t('idleBrightness')}
        value={config.led.idleBrightness}
        min={MOCK_BOUNDS.brightness.min}
        max={MOCK_BOUNDS.brightness.max}
        step={1}
        unit="PWM"
        formatValue={(value) => `${formatNumber(value, locale, 0)} PWM (${formatNumber((value / 255) * 100, locale, 0)}%)`}
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ idleBrightness: value })}
      />
      <NumberStepper
        label={t('activityWeight')}
        value={config.led.activityWeight}
        min={MOCK_BOUNDS.weight.min}
        max={MOCK_BOUNDS.weight.max}
        step={0.05}
        unit=""
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ activityWeight: value })}
      />
      <NumberStepper
        label={t('mistWeight')}
        value={config.led.mistWeight}
        min={MOCK_BOUNDS.weight.min}
        max={MOCK_BOUNDS.weight.max}
        step={0.05}
        unit=""
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ mistWeight: value })}
      />
      <DurationStepper
        label={t('rampDuration')}
        value={config.led.rampMs}
        min={MOCK_BOUNDS.rampMs.min}
        max={MOCK_BOUNDS.rampMs.max}
        stepMs={100}
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => update({ rampMs: value })}
      />
    </View>
  );
}

function AutomationSettings({
  config,
  updateDraft,
  theme,
  locale,
  t,
  disabled,
}: SettingsContext) {
  return (
    <View style={styles.settings}>
      <DurationStepper
        label={t('cycleDuration')}
        value={config.evolutionCycleMs}
        min={MOCK_BOUNDS.cycleMs.min}
        max={MOCK_BOUNDS.cycleMs.max}
        stepMs={60_000}
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => updateDraft((current) => ({ ...current, evolutionCycleMs: value }))}
      />
      <NumberStepper
        label={t('targetBlendFactor')}
        value={config.evolutionBlendFactor}
        min={MOCK_BOUNDS.blendFactor.min}
        max={MOCK_BOUNDS.blendFactor.max}
        step={0.05}
        unit=""
        theme={theme}
        locale={locale}
        t={t}
        disabled={disabled}
        onChange={(value) => updateDraft((current) => ({ ...current, evolutionBlendFactor: value }))}
      />
    </View>
  );
}

function DurationStepper({
  label,
  value,
  min,
  max,
  stepMs = 1_000,
  ...props
}: Omit<NumberStepperProps, 'value' | 'min' | 'max' | 'step' | 'unit' | 'onChange'> & {
  value: number;
  min: number;
  max: number;
  stepMs?: number;
  onChange: (value: number) => void;
}) {
  return (
    <NumberStepper
      {...props}
      label={label}
      value={value / 1000}
      min={min / 1000}
      max={max / 1000}
      step={stepMs / 1000}
      unit="s"
      formatValue={(seconds) => `${formatNumber(seconds, props.locale, 1)} s`}
      onChange={(seconds) => props.onChange(Math.round(seconds * 1000))}
    />
  );
}

type NumberStepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  formatValue?: (value: number) => string;
  theme: ThemeDefinition;
  locale: string;
  t: Translate;
  disabled: boolean;
  onChange: (value: number) => void;
};

function NumberStepper({
  label,
  value,
  min,
  max,
  step,
  unit,
  formatValue,
  theme,
  locale,
  t,
  disabled,
  onChange,
}: NumberStepperProps) {
  const formattedValue = formatValue?.(value) ?? `${formatNumber(value, locale, 2)}${unit ? ` ${unit}` : ''}`;
  const boundText = t('mockBounds', {
    min: formatNumber(min, locale, 2),
    max: formatNumber(max, locale, 2),
    unit,
  });

  function changeBy(direction: -1 | 1) {
    const decimals = step < 1 ? 2 : 0;
    const factor = 10 ** decimals;
    const next = Math.min(max, Math.max(min, Math.round((value + direction * step) * factor) / factor));
    if (next !== value) {
      onChange(next);
    }
  }

  return (
    <View style={[styles.stepperRow, { borderColor: theme.colors.border }]}>
      <View style={styles.stepperLabels}>
        <Text style={[theme.typography.label, { color: theme.colors.text }]}>{label}</Text>
        <Text style={[theme.typography.label, styles.boundText, { color: theme.colors.secondaryText }]}>{boundText}</Text>
      </View>
      <View style={styles.stepperControl}>
        <StepperButton
          label={t('decreaseValue', { label })}
          symbol="−"
          onPress={() => changeBy(-1)}
          disabled={disabled || value <= min}
          theme={theme}
        />
        <Text
          accessibilityLabel={t('stepperValue', { label, value: formattedValue })}
          style={[theme.typography.label, styles.stepperValue, { color: theme.colors.text }]}
        >
          {formattedValue}
        </Text>
        <StepperButton
          label={t('increaseValue', { label })}
          symbol="+"
          onPress={() => changeBy(1)}
          disabled={disabled || value >= max}
          theme={theme}
        />
      </View>
    </View>
  );
}

function StepperButton({
  label,
  symbol,
  onPress,
  disabled,
  theme,
}: {
  label: string;
  symbol: string;
  onPress: () => void;
  disabled: boolean;
  theme: ThemeDefinition;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepperButton,
        {
          borderColor: theme.colors.border,
          borderRadius: theme.shape.buttonRadius,
          opacity: pressed ? theme.interaction.pressedOpacity : disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[theme.typography.button, { color: theme.colors.text }]}>{symbol}</Text>
    </Pressable>
  );
}

function StatsCard({ children, theme }: { children: React.ReactNode; theme: ThemeDefinition }) {
  return (
    <View
      style={[
        styles.statsCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.shape.cardRadius,
          borderWidth: theme.shape.borderWidth,
        },
      ]}
    >
      {children}
    </View>
  );
}

function StatRow({ label, value, theme }: { label: string; value: string; theme: ThemeDefinition }) {
  return (
    <View style={[styles.statRow, { borderColor: theme.colors.border }]}>
      <Text style={[theme.typography.label, styles.statLabel, { color: theme.colors.secondaryText }]}>{label}</Text>
      <Text style={[theme.typography.label, styles.statValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

function getDetailsTitle(resource: DetailsResource, t: Translate): string {
  switch (resource.kind) {
    case 'pump':
      return t('detailsTitle', { resource: t('pumpTitle', { number: resource.id }) });
    case 'mist':
      return t('detailsTitle', { resource: t('mistTitle') });
    case 'led':
      return t('detailsTitle', { resource: t('ledTitle') });
    case 'automation':
      return t('detailsTitle', { resource: t('automationTitle') });
  }
}

function resourceKey(resource: DetailsResource): string {
  return resource.kind === 'pump' ? `pump-${resource.id}` : resource.kind;
}

function formatNumber(value: number, locale: string, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

function formatBrightness(value: number, locale: string): string {
  return `${formatNumber(value, locale, 0)} / 255 PWM (${formatNumber((value / 255) * 100, locale, 0)}%)`;
}

function formatDuration(valueMs: number, locale: string): string {
  return `${formatNumber(valueMs / 1000, locale, 1)} s`;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buttonStyle(theme: ThemeDefinition, minHeight: number, pressed: boolean, disabled: boolean) {
  return [
    styles.button,
    {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.shape.buttonRadius,
      minHeight,
      opacity: pressed ? theme.interaction.pressedOpacity : disabled ? 0.55 : 1,
      paddingHorizontal: theme.spacing.buttonHorizontal / 2,
      paddingVertical: theme.spacing.buttonVertical / 2,
    },
  ];
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flex: 1 },
  scrollContent: { alignItems: 'center' },
  topControls: { alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end', zIndex: 2 },
  fixedControls: { alignItems: 'center', elevation: 2, position: 'relative', zIndex: 2 },
  title: { marginBottom: 8 },
  statusRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  simulatedBadge: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 3 },
  description: { marginBottom: 16 },
  cards: { gap: 12 },
  card: { gap: 12, width: '100%' },
  cardTitle: { fontSize: 22, lineHeight: 28 },
  modeGroup: { flexDirection: 'row', gap: 8 },
  modeOption: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  values: { flexDirection: 'row', gap: 12 },
  valueSummary: { flex: 1 },
  valueText: { fontSize: 22, lineHeight: 28 },
  meterTrack: { borderRadius: 8, height: 12, overflow: 'hidden' },
  meterFill: { height: '100%' },
  slider: { height: 44, width: '100%' },
  statusText: { gap: 4 },
  button: { alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  dismissOverlay: { ...StyleSheet.absoluteFill, elevation: 1, zIndex: 1 },
  automationCard: { gap: 10, marginTop: 12 },
  actionsBar: { borderTopWidth: StyleSheet.hairlineWidth, gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionButton: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  discardConfirmation: { gap: 8 },
  modal: { flex: 1 },
  modalHeader: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingTop: 8,
  },
  modalTitle: { flex: 1, fontSize: 22, lineHeight: 28 },
  detailsContent: { alignItems: 'center' },
  sectionTitle: { marginBottom: 8, marginTop: 8 },
  statsCard: { marginBottom: 12, paddingHorizontal: 12, width: '100%' },
  statRow: { borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, paddingVertical: 10 },
  statLabel: { flex: 1 },
  statValue: { flex: 1, textAlign: 'right' },
  settings: { marginBottom: 12 },
  stepperRow: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 10, paddingVertical: 12 },
  stepperLabels: { gap: 2 },
  boundText: { fontSize: 12 },
  stepperControl: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  stepperButton: { alignItems: 'center', borderWidth: 1, justifyContent: 'center', minHeight: 44, minWidth: 44 },
  stepperValue: { flex: 1, textAlign: 'center' },
});
