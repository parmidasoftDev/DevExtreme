import { promises as fs } from 'fs';
import {
  resolve, relative, join, dirname,
} from 'path';
import MetadataGenerator from './generator';

export default class MetadataCollector {
  generator = new MetadataGenerator();

  static async saveScssFiles(files: Promise<FileInfo[]>, destination: string): Promise<void> {
    await Promise.all((await files).map(async (file) => {
      const absolutePath = resolve(join(destination, file.path));
      const directory = dirname(absolutePath);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(absolutePath, file.content);
    }));
  }

  static getStringFromObject(
    object: ThemesMetadata | string[] | FlatStylesDependencies,
  ): string {
    return JSON.stringify(object, null, 2).replace(/"/g, '\'').replace(/'(ON|OFF)'/g, '"$1"');
  }

  async getFileList(dirName: string): Promise<string[]> {
    const directories = await fs.readdir(dirName, { withFileTypes: true });
    const files = await Promise.all(directories.map((directory) => {
      const res = resolve(dirName, directory.name);
      return directory.isDirectory() ? this.getFileList(res) : [res];
    }));
    return Array.prototype.concat(...files) as string[];
  }

  async readFiles(
    dirName: string,
    handler: (content: string) => string,
  ): Promise<FileInfo[]> {
    const fileList = await this.getFileList(dirName);

    return Promise.all(fileList.map(async (filePath) => {
      const relativePath = relative(dirName, filePath);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      let modifiedContent = this.generator.collectMetadata(filePath, fileContent);
      modifiedContent = handler(modifiedContent);
      return { path: relativePath, content: modifiedContent };
    }));
  }

  async saveMetadata(
    filePath: string,
    version: string,
    browsersList: string[],
    dependencies: FlatStylesDependencies,
  ): Promise<void> {
    const absolutePath = resolve(filePath);
    const metadata = this.generator.getMetadata();
    const metaString = MetadataCollector.getStringFromObject(metadata);
    const browsersListString = MetadataCollector.getStringFromObject(browsersList);
    const dependenciesString = MetadataCollector.getStringFromObject(dependencies);

    const metaContent = `export const metadata: ThemesMetadata = ${metaString};
export const version: string = '${version}';
export const browsersList: Array<string> = ${browsersListString};
export const dependencies: FlatStylesDependencies = ${dependenciesString};
`;
    await fs.mkdir(dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, metaContent);
  }
}
