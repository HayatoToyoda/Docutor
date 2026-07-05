import "./index.css";
import { Composition } from "remotion";
import { DocutorDemo, TOTAL_D } from "./DocutorDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DocutorDemo"
        component={DocutorDemo}
        durationInFrames={TOTAL_D}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
