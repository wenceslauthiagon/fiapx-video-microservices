declare module 'fluent-ffmpeg' {
  type EndCallback = () => void;
  type ErrorCallback = (error: unknown) => void;

  interface FfmpegCommand {
    setFfmpegPath(path: string): FfmpegCommand;
    videoCodec(codec: string): FfmpegCommand;
    audioCodec(codec: string): FfmpegCommand;
    outputOptions(options: string[]): FfmpegCommand;
    format(format: string): FfmpegCommand;
    on(event: 'end', listener: EndCallback): FfmpegCommand;
    on(event: 'error', listener: ErrorCallback): FfmpegCommand;
    save(outputPath: string): void;
  }

  function ffmpeg(input?: string): FfmpegCommand;

  export default ffmpeg;
}
