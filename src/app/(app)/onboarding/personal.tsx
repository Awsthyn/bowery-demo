import { Controller } from 'react-hook-form';
import type { TextInputProps } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';

import { StepScaffold } from '@/components/StepScaffold';
import type { PersonalForm } from '@/features/onboarding/schemas';
import { usePersonalForm } from '@/features/onboarding/usePersonalForm';
import { useUid } from '@/stores/sessionStore';

type FieldDef = {
  name: keyof PersonalForm;
  label: string;
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
  {
    name: 'dateOfBirth',
    label: 'Date of birth',
    input: { keyboardType: 'numbers-and-punctuation', placeholder: 'YYYY-MM-DD' },
  },
  { name: 'nationality', label: 'Nationality', input: { autoCapitalize: 'words' } },
  { name: 'documentNumber', label: 'ID document number', input: { autoCapitalize: 'characters' } },
];

export default function PersonalStep() {
  const uid = useUid();
  const { control, formState } = usePersonalForm(uid);

  return (
    <StepScaffold
      step={0}
      subtitle="Use the same details that appear on your ID document."
      canContinue={formState.isValid}
    >
      <View style={styles.fields}>
        {FIELDS.map(({ name, label, input }) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field, fieldState }) => (
              <View>
                <TextInput
                  mode="outlined"
                  label={label}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={!!fieldState.error && fieldState.isTouched}
                  testID={`field-${name}`}
                  {...input}
                />
                <HelperText type="error" visible={!!fieldState.error && (fieldState.isTouched || fieldState.isDirty)}>
                  {fieldState.error?.message}
                </HelperText>
              </View>
            )}
          />
        ))}
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({ fields: { gap: 2 } });
