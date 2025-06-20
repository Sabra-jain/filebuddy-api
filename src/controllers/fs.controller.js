import fs from 'fs/promises';
import path from 'path';


const BASE_DIR = process.cwd();

export const listDirectory = async (req, res) => {
  const userPath = req.query.path || '.';
  const targetPath = path.resolve(BASE_DIR, userPath);

  try {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });

    const result = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(targetPath, entry.name);
        const entryStat = await fs.stat(entryPath);

        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entryStat.size,
          lastModified: entryStat.mtime,
        };
      })
    );

    res.json(result);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Path not found' });
    } else if (err.code === 'ENOTDIR') {
      return res.status(400).json({ error: 'Path is not a directory' });
    }
    return res.status(500).json({ error: 'Failed to list directory' });
  }
};


export const createItem = async (req, res) => {
  const { path: userPath, type } = req.body;

  if (!userPath || !['file', 'dir'].includes(type)) {
    return res.status(400).json({ error: 'Invalid path or type (file/dir)' });
  }

  const targetPath = path.resolve(BASE_DIR, userPath);

  if (type === 'dir') {
    try {
      await fs.mkdir(targetPath);
      return res.status(201).json({ message: 'Folder successfully created' });
    } catch (error) {
      if (error.code === 'EEXIST') {
        return res.status(409).json({ error: 'Folder already exists' });
      }
      return res.status(500).json({ error: 'Failed to create folder', details: error.message });
    }
  }

  if (type === 'file') {
    try {
      const parentDir = path.dirname(targetPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.writeFile(targetPath, '', { flag: 'wx' }); // fail if file already exists
      return res.status(201).json({ message: 'File successfully created' });
    } catch (error) {
      if (error.code === 'EEXIST') {
        return res.status(409).json({ error: 'File already exists' });
      }
      return res.status(500).json({ error: 'Failed to create file', details: error.message });
    }
  }
};


export const viewFileContent = async (req, res) => {
  const userPath = req.query.path;

  if (!userPath) {
    return res.status(400).json({ error: 'Please provide the path query parameter' });
  }

  const targetPath = path.resolve(BASE_DIR, userPath);

  try {
    const stats = await fs.stat(targetPath);

    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Provided path is a directory, not a file' });
    }

    const content = await fs.readFile(targetPath, { encoding: 'utf8' });
    res.type('text/plain').send(content);

  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File does not exist' });
    }

    res.status(500).json({ error: 'Failed to read file', details: err.message });
  }
};


export const deletePath = async (req, res) => {
  const userPath = req.query.path;
  const recursive = req.query.recursive === 'true';

  if (!userPath) {
    return res.status(400).json({ error: "Path query parameter is required" });
  }

  const targetPath = path.resolve(BASE_DIR, userPath);

  try {
    const stats = await fs.stat(targetPath);

    if (stats.isFile()) {
      await fs.unlink(targetPath);
      return res.status(200).json({ message: "File deleted successfully" });
    }

    if (stats.isDirectory()) {
      if (recursive) {
        await fs.rm(targetPath, { recursive: true, force: true });
        return res.status(200).json({ message: "Directory deleted recursively" });
      }

      const items = await fs.readdir(targetPath);
      if (items.length > 0) {
        return res.status(400).json({ error: "Directory not empty. Use recursive=true to delete." });
      }

      await fs.rmdir(targetPath);
      return res.status(200).json({ message: "Empty directory deleted" });
    }

  } catch (err) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ error: "Path not found" });
    }
    return res.status(500).json({ error: "Failed to delete path", details: err.message });
  }
};


export const copyPath = async (req, res) => {
  const { sourcePath, destinationPath, recursive = false } = req.body;

  if (!sourcePath || !destinationPath) {
    return res.status(400).json({ error: 'sourcePath and destinationPath are required' });
  }

  const src = path.resolve(BASE_DIR, sourcePath);
  const dest = path.resolve(BASE_DIR, destinationPath);

  try {
    const stat = await fs.stat(src);

    if (stat.isDirectory()) {
      if (!recursive) {
        return res.status(400).json({ error: 'Use recursive: true to copy directories' });
      }

      await fs.cp(src, dest, { recursive: true });
    } else {
      await fs.copyFile(src, dest);
    }

    res.status(200).json({ message: 'Copy successful' });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Source path not found' });
    }
    res.status(500).json({ error: 'Failed to copy path', details: err.message });
  }
};


export const movePath = async (req, res) => {
  const { sourcePath, destinationPath, recursive = false } = req.body;

  if (!sourcePath || !destinationPath) {
    return res.status(400).json({ error: 'sourcePath and destinationPath are required' });
  }

  const src = path.resolve(BASE_DIR, sourcePath);
  const dest = path.resolve(BASE_DIR, destinationPath);

  try {
    const stat = await fs.stat(src);

    if (stat.isDirectory()) {
      if (!recursive) {
        return res.status(400).json({ error: 'Use recursive: true to move directories' });
      }
      await fs.cp(src, dest, { recursive: true });
      await fs.rm(src, { recursive: true });
    } else {
      await fs.copyFile(src, dest);
      await fs.unlink(src);
    }

    res.status(200).json({ message: 'Move successful' });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Source path not found' });
    }
    res.status(500).json({ error: 'Failed to move path', details: err.message });
  }
};
