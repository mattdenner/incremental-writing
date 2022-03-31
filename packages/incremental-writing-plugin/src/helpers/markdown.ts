import YAML from 'yaml';
import { GrayMatterFile } from "gray-matter"; // ... import
export { GrayMatterFile } from "gray-matter"; // ... re-export

export default function matter(input: string): GrayMatterFile<string> {
  const file = {
    content: input,
    data: {},
    excerpt: "",
    language: "yaml",
    matter: "",
    orig: input,
    stringify: (_s: string) => '',
  };
  
  const open = "---";
  const close = "---";
  
  let str = file.content;
  str = str.slice(open.length);

  let closeIndex = str.indexOf(close);
  if (closeIndex === -1) closeIndex = str.length;
  file.matter = str.slice(0, closeIndex);
  file.data = YAML.parse(file.matter);
  file.content = str.slice(closeIndex + close.length);
  if (file.content[0] === '\r') file.content = file.content.slice(1);
  if (file.content[0] === '\n') file.content = file.content.slice(1);
  
  Reflect.defineProperty(file, 'stringify', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: (_data: any, _options: any): string => {
      const matter = YAML.stringify(file.data);
      return [open, matter, close, file.content].join("\n");
    },
  });
  return file;
}
