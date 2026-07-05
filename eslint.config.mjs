import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: ["mock-design-first/**"] },
  ...nextVitals,
  ...nextTypescript,
];

export default eslintConfig;
