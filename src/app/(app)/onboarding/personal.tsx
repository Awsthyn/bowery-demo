import { useState } from 'react';
import { Controller } from 'react-hook-form';
import type { TextInputProps } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';

import { DateField } from '@/components/DateField';
import { StepScaffold, useStepNavigation } from '@/components/StepScaffold';
import { MAX_AGE, MIN_AGE, type PersonalForm } from '@/features/onboarding/schemas';
import { yearsAgo } from '@/lib/dates';
import { usePersonalForm } from '@/features/onboarding/usePersonalForm';
import { useUid } from '@/stores/sessionStore';

type FieldDef = {
  name: keyof PersonalForm;
  label: string;
  /** `date` renders a native date picker instead of a text input. */
  type?: 'date';
  input?: Pick<TextInputProps, 'keyboardType' | 'autoCapitalize' | 'autoComplete' | 'placeholder'>;
};

const FIELDS: FieldDef[] = [
  { name: 'fullName', label: 'Full name', input: { autoCapitalize: 'words', autoComplete: 'name' } },
  {
    name: 'email',
    label: 'Email',
    input: { keyboardType: 'email-address', autoCapitalize: 'none', autoComplete: 'email' },
  },
  { name: 'phone', label: 'Phone', input: { keyboardType: 'phone-pad', autoComplete: 'tel', placeholder: '+1 555 123 4567' } },
  { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
  { name: 'nationality', label: 'Nationality', input: { autoCapitalize: 'words' } },
  { name: 'documentNumber', label: 'ID document number', input: { keyboardType: 'number-pad' } },
];

export default function PersonalStep() {
  const uid = useUid();
  const { control, formState, handleSubmit, setFocus } = usePersonalForm(uid);
  const { goNext } = useStepNavigation(0);
  // Computed once per mount (not during every render): the picker cannot select anyone under 18.
  const [dobRange] = useState(() => ({ max: yearsAgo(MIN_AGE), min: yearsAgo(MAX_AGE) }));

  // Keyboard "done" on the last field: advance if valid, otherwise jump to the first invalid field.
  const submitFromKeyboard = handleSubmit(goNext, (errors) => {
    const firstInvalid = FIELDS.find((f) => errors[f.name]);
    if (firstInvalid) setFocus(firstInvalid.name);
  });

  return (
    <StepScaffold
      step={0}
      subtitle="Use the same details that appear on your ID document."
      canContinue={formState.isValid}
    >
      <View style={styles.fields}>
        {FIELDS.map(({ name, label, type, input }, index) => {
          const next = FIELDS[index + 1];
          return (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field, fieldState }) => {
                const showError =
                  !!fieldState.error && (fieldState.isTouched || fieldState.isDirty || formState.isSubmitted);
                if (type === 'date') {
                  return (
                    <View>
                      <DateField
                        inputRef={field.ref}
                        label={label}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={showError}
                        maximumDate={dobRange.max}
                        minimumDate={dobRange.min}
                        onPicked={() => next && setFocus(next.name)}
                        testID={`field-${name}`}
                      />
                      <HelperText type="error" visible={showError}>
                        {fieldState.error?.message}
                      </HelperText>
                    </View>
                  );
                }
                return (
                  <View>
                    <TextInput
                      ref={field.ref}
                      mode="outlined"
                      label={label}
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      error={showError}
                      returnKeyType={next ? 'next' : 'done'}
                      // Keep the keyboard open while hopping between fields to avoid a close/open flicker.
                      submitBehavior={next ? 'submit' : 'blurAndSubmit'}
                      onSubmitEditing={() => (next ? setFocus(next.name) : void submitFromKeyboard())}
                      testID={`field-${name}`}
                      {...input}
                    />
                    <HelperText type="error" visible={showError}>
                      {fieldState.error?.message}
                    </HelperText>
                  </View>
                );
              }}
            />
          );
        })}
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({ fields: { gap: 2 } });
