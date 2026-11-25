import AppProviders from './src/AppProviders';
import DeviceControlScreen from './src/features/device-control/DeviceControlScreen';

export default function App() {
  return (
    <AppProviders>
      <DeviceControlScreen />
    </AppProviders>
  );
}
