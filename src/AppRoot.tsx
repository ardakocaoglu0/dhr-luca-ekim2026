import AppView from "./App";
import raw from "./data/comparison.json";
import matrix from "./data/matrix.json";
import type { ComparisonData } from "./types";
import type { MatrixData } from "./matrixTypes";

export default function App() {
  return <AppView data={raw as ComparisonData} matrix={matrix as MatrixData} />;
}
