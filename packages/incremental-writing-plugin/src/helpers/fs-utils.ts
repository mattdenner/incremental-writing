import { Platform } from "obsidian";
import * as nativePath from "path";

const path: {
  relative: (a: string, b:string) => string,
} = (function(hasProperFilesystemSupport: boolean) {
  /*
  if (hasProperFilesystemSupport) {
    return {
      relative: nativePath.relative,
    };
  }
  */
  
  // We have to write our own relative file path behaviour because the `path` library seems completely broken!
  const sep = Platform.isAndroidApp ? "/" : "/"; // TODO: probably should care
  return {
    relative: (source: string, destination: string) => {
      // Split the two paths up into their component parts.
      const sourceParts = source.split(sep);
      const destinationParts = destination.split(sep);
      
      // Find the point at which they vary
      let index = 0;
      for ( ; index < Math.min(sourceParts.length, destinationParts.length); index++) {
        if (sourceParts[index] !== destinationParts[index]) break;
      }
      
      // The number of relative moves is the difference between the match position and the length of sourceParts.
      const stepsToCommonPoint = Array(sourceParts.length - index).fill("..");
      const stepsFromCommonPoint = destinationParts.slice(index);
      return [ ...stepsToCommonPoint, ...stepsFromCommonPoint ].join(sep);
    },
  };
})(!!Platform.isDesktopApp);

export default path;