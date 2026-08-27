import AppView from "./App";
import raw from "./data/comparison.json";
import type { ComparisonData } from "./types";

export default function App() {
  return <AppView data={raw as ComparisonData} />;
}
