import { Composition } from "remotion";
import { Ad916 } from "./Ad916";
import { type Ad916Props, FPS, totalFrames } from "./types";

const defaults: Ad916Props = {
  shots: [{ src: "https://placehold.co/1080x1920/png", durationSec: 2, text: "Preview" }],
  brandName: "Brand",
  colors: ["#C07848", "#A8C048", "#D89048", "#FFF0E0"],
  cta: "Learn more",
  endCardSec: 2,
};

export function Root() {
  return (
    <Composition
      id="Ad916"
      component={Ad916}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={totalFrames(defaults)}
      defaultProps={defaults}
      calculateMetadata={({ props }) => ({ durationInFrames: totalFrames(props) })}
    />
  );
}
