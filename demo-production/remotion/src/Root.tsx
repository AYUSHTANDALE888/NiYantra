import { Composition } from 'remotion';
import { Showcase, timelineFor } from './Showcase';

export const RemotionRoot: React.FC = () => {
  const main = timelineFor('main');
  const short = timelineFor('short');
  return (
    <>
      <Composition id="Main" component={Showcase} defaultProps={{ cut: 'main' as const }} width={1920} height={1080} fps={30} durationInFrames={main.frames} />
      <Composition id="Short" component={Showcase} defaultProps={{ cut: 'short' as const }} width={1920} height={1080} fps={30} durationInFrames={short.frames} />
    </>
  );
};
