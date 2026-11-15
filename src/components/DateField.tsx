import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import { Button, Dialog, Portal, TextInput, useTheme } from 'react-native-paper';

import { formatDisplayDate, fromIsoDate, toIsoDate } from '@/lib/dates';

type Props = {
  label: string;
  /** `yyyy-mm-dd` or empty. */
  value: string;
  onChange: (iso: string) => void;
  onBlur: () => void;
  error?: boolean;
  maximumDate: Date;
  minimumDate?: Date;
  /** Receives a `{ focus }` handle so react-hook-form's `setFocus` opens the picker. */
  inputRef?: (handle: { focus: () => void } | null) => void;
  /** Called after a date is chosen (used to move focus to the next field). */
  onPicked?: () => void;
  testID?: string;
};

/**
 * Read-only text field that opens the native date picker: the system dialog on Android,
 * an inline calendar inside a Paper dialog on iOS.
 */
export function DateField({
  label,
  value,
  onChange,
  onBlur,
  error,
  maximumDate,
  minimumDate,
  inputRef,
  onPicked,
  testID,
}: Props) {
  const theme = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(maximumDate);
  const initial = fromIsoDate(value) ?? maximumDate;

  const commit = (date: Date) => {
    onChange(toIsoDate(date));
    onBlur();
    onPicked?.();
  };

  const open = () => {
    Keyboard.dismiss();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        maximumDate,
        minimumDate,
        onChange: (event, date) => {
          if (event.type === 'set' && date) commit(date);
          else onBlur();
        },
      });
    } else {
      setIosDraft(initial);
      setIosOpen(true);
    }
  };

  // Hand react-hook-form a `{ focus }` handle bound to the current `open`, so setFocus() opens the picker.
  useEffect(() => {
    inputRef?.({ focus: open });
  });
  useEffect(() => () => inputRef?.(null), [inputRef]);

  return (
    <>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={label} testID={testID}>
        <View pointerEvents="none">
          <TextInput
            mode="outlined"
            label={label}
            value={formatDisplayDate(value)}
            editable={false}
            error={error}
            right={<TextInput.Icon icon="calendar" />}
          />
        </View>
      </Pressable>

      {Platform.OS === 'ios' && (
        <Portal>
          <Dialog visible={iosOpen} onDismiss={() => (setIosOpen(false), onBlur())}>
            <Dialog.Content>
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="inline"
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                themeVariant={theme.dark ? 'dark' : 'light'}
                accentColor={theme.colors.primary}
                onChange={(_, date) => date && setIosDraft(date)}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => (setIosOpen(false), onBlur())}>Cancel</Button>
              <Button
                onPress={() => {
                  setIosOpen(false);
                  commit(iosDraft);
                }}
              >
                Done
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}
    </>
  );
}
