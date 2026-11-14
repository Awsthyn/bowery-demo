import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

type Photo = { uri: string; width: number; height: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (photo: Photo) => Promise<void>;
};

/** Front camera with an oval face guide. Used instead of the system picker, which often ignores "front" on Android. */
export function SelfieCamera({ visible, onClose, onCapture }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const capture = async () => {
    if (!camera.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 1 });
      onClose();
      if (photo) await onCapture(photo);
    } catch (e) {
      console.warn('Selfie capture failed', e);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => setReady(false)}>
      <View style={styles.root}>
        {!permission?.granted ? (
          <SafeAreaView style={styles.permission}>
            <Text variant="titleMedium" style={styles.white}>
              Camera access is needed for the selfie.
            </Text>
            <Button mode="contained" onPress={requestPermission}>
              Allow camera
            </Button>
            <Button textColor="white" onPress={onClose}>
              Cancel
            </Button>
          </SafeAreaView>
        ) : (
          <>
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing="front"
              mirror
              onCameraReady={() => setReady(true)}
            />
            <View pointerEvents="none" style={styles.overlay}>
              <View style={styles.oval} />
              <Text variant="titleMedium" style={[styles.white, styles.hint]}>
                Fit your face inside the oval
              </Text>
            </View>
            <SafeAreaView style={styles.controls} edges={['bottom', 'top']}>
              <IconButton icon="close" iconColor="white" onPress={onClose} accessibilityLabel="Close camera" />
              <IconButton
                icon="camera-iris"
                mode="contained"
                size={40}
                onPress={capture}
                disabled={!ready || capturing}
                accessibilityLabel="Take selfie"
              />
              <View style={styles.spacer} />
            </SafeAreaView>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  white: { color: 'white', textAlign: 'center' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  oval: { width: 240, height: 320, borderRadius: 160, borderWidth: 3, borderColor: 'white' },
  hint: { marginTop: 24, textShadowColor: 'black', textShadowRadius: 4 },
  controls: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  spacer: { width: 48 },
});
