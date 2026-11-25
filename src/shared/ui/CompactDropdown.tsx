import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeDefinition } from '../../theme/types';

export type DropdownOption<Value extends string> = {
  value: Value;
  label: string;
};

type CompactDropdownProps<Value extends string> = {
  accessibilityLabel: string;
  disabled: boolean;
  expanded: boolean;
  minTouchHeight: number;
  onClose: () => void;
  onSelect: (value: Value) => void;
  onToggle: () => void;
  options: readonly DropdownOption<Value>[];
  selectedLabel: string;
  title: string;
  theme: ThemeDefinition;
  value: Value;
};

export function CompactDropdown<Value extends string>({
  accessibilityLabel,
  disabled,
  expanded,
  minTouchHeight,
  onClose,
  onSelect,
  onToggle,
  options,
  selectedLabel,
  title,
  theme,
  value,
}: CompactDropdownProps<Value>) {
  return (
    <View style={[styles.root, { zIndex: expanded ? 2 : 0 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded, disabled }}
        disabled={disabled}
        hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
        onPress={onToggle}
        style={styles.trigger}
      >
        {({ pressed }) => (
          <View
            style={[
              styles.triggerFace,
              {
                backgroundColor: theme.colors.surface,
                borderColor: expanded ? theme.colors.accent : theme.colors.border,
                borderRadius: theme.shape.choiceRadius,
                borderWidth: theme.shape.dropdownBorderWidth,
                opacity: pressed ? theme.interaction.pressedOpacity : 1,
                paddingHorizontal: theme.spacing.dropdownHorizontal,
                paddingVertical: theme.spacing.dropdownVertical,
              },
            ]}
          >
            <Text numberOfLines={1} style={[theme.typography.label, { color: theme.colors.text }]}>
              {selectedLabel}
            </Text>
            <Text style={[theme.typography.label, styles.arrow, { color: theme.colors.text }]}>⌄</Text>
          </View>
        )}
      </Pressable>
      {expanded ? (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={title}
          style={[
            styles.menu,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.shape.choiceRadius,
              borderWidth: theme.shape.borderWidth,
              minWidth: 160,
            },
          ]}
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.menuOption,
                  {
                    backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                    borderRadius: theme.shape.choiceRadius,
                    minHeight: minTouchHeight,
                    opacity: pressed ? theme.interaction.pressedOpacity : 1,
                    paddingHorizontal: theme.spacing.choiceHorizontal,
                    paddingVertical: theme.spacing.choiceVertical,
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.label,
                    styles.menuOptionText,
                    { color: selected ? theme.colors.onPrimary : theme.colors.text },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  trigger: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerFace: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  arrow: {
    fontSize: 12,
    lineHeight: 14,
  },
  menu: {
    elevation: 8,
    maxWidth: 240,
    padding: 4,
    position: 'absolute',
    right: 0,
    top: '100%',
  },
  menuOption: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  menuOptionText: {
    flexShrink: 1,
  },
});
