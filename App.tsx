import AppProviders from './src/AppProviders';
import RandomNumberScreen from './src/features/random-number/RandomNumberScreen';

export default function App() {
  return (
    <AppProviders>
      <RandomNumberScreen />
    </AppProviders>
  );
}
