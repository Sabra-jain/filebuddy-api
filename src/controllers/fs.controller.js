import fs from 'fs/promises';
import path from 'path';
import File from '../models/file.model.js';


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

  try {
    const targetPath = path.resolve(BASE_DIR, userPath);
    const parts = path.relative(BASE_DIR, targetPath).split(path.sep);
    let relativePath = "";

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      if (name === '..' || !name) continue;

      relativePath = path.join(relativePath, name);
      const currentPath = path.resolve(BASE_DIR, ...parts.slice(0, i + 1));
      const isLast = i === parts.length - 1;
      const isDir = type === "dir" || !isLast;

      const existing = await File.findOne({
        owner: req.user.id,
        path: relativePath,
        type: isDir ? "folder" : "file",
      });

      if (!existing) {
        await File.create({
          owner: req.user.id,
          filename: name,
          path: relativePath,
          type: isDir ? "folder" : "file",
        });
      } else if (isLast) {
        return res.status(409).json({ message: `${type} already exists` });
      }

      try {
        if (isDir) {
          await fs.mkdir(currentPath);
        } else {
          await fs.writeFile(currentPath, "", { flag: "wx" });
        }
      } catch (err) {
        if (err.code !== "EEXIST") throw err;
      }
    }

    return res.status(201).json({ message: `${type} successfully created` });
  } catch (error) {
    return res.status(500).json({ error: `Failed to create ${type}`, details: error.message });
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

    const cleanPath = path.normalize(userPath).replace(/^(\.\.[\/\\])+/, '');
    const topFolder = cleanPath.split(/[\/\\]/)[0];

    if (stats.isFile()) {
      await fs.unlink(targetPath);

      await File.deleteOne({
        owner: req.user.id,
        path: cleanPath
      });

      return res.status(200).json({ message: "File deleted successfully" });
    }

    if (stats.isDirectory()) {
      if (recursive) {
        await fs.rm(targetPath, { recursive: true, force: true });

        // Delete all mongo entries where path === "a" OR starts with "a/"
        const allFiles = await File.find({ owner: req.user.id });

        const toDelete = allFiles.filter(file =>
          file.path === topFolder || file.path.startsWith(`${topFolder}/`) || file.path.startsWith(`${topFolder}\\`)
        );

        if (toDelete.length > 0) {
          const ids = toDelete.map(file => file._id);
          await File.deleteMany({ _id: { $in: ids } });
        }

        return res.status(200).json({ message: "Directory and all related entries deleted" });
      }

      const items = await fs.readdir(targetPath);
      if (items.length > 0) {
        return res.status(400).json({ error: "Directory not empty. Use recursive=true to delete." });
      }

      await fs.rmdir(targetPath);

      await File.deleteOne({
        owner: req.user.id,
        path: topFolder
      });

      return res.status(200).json({ message: "Empty directory deleted" });
    }

  } catch (err) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ error: "Path not found" });
    }
    return res.status(500).json({ error: "Failed to delete path", details: err.message });
  }
};




const toUnixPath = (p) => p.replace(/\\/g, "/");

const walkAndLog = async (base, ownerId, includeRoot = false) => {
  const entries = [];

  if (includeRoot) {
    const baseName = path.basename(base);
    const relBase = toUnixPath(path.relative(BASE_DIR, base));
    entries.push({
      owner: ownerId,
      filename: baseName,
      path: relBase,
      type: "folder"
    });
  }

  const walk = async (dir) => {
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      const relPath = toUnixPath(path.relative(BASE_DIR, fullPath));

      entries.push({
        owner: ownerId,
        filename: item.name,
        path: relPath,
        type: item.isDirectory() ? "folder" : "file",
      });

      if (item.isDirectory()) {
        await walk(fullPath);
      }
    }
  };

  await walk(base);
  return entries;
};

export const copyPath = async (req, res) => {
  const { sourcePath, destinationPath, recursive = false } = req.body;

  if (!sourcePath || !destinationPath) {
    return res.status(400).json({ error: 'sourcePath and destinationPath are required' });
  }

  const src = path.resolve(BASE_DIR, sourcePath);
  const dest = path.resolve(BASE_DIR, destinationPath);

  const relativeDest = toUnixPath(path.relative(BASE_DIR, dest));
  const filename = path.basename(destinationPath);

  try {
    const stat = await fs.stat(src);

    if (stat.isDirectory()) {
      if (!recursive) {
        return res.status(400).json({ error: 'Use recursive: true to copy directories' });
      }

      await fs.cp(src, dest, { recursive: true });

      // Log root folder
      const logs = await walkAndLog(dest, req.user.id);

      // Add root folder entry manually beacuse walkAndLog only gives inside files/folders
      logs.unshift({
        owner: req.user.id,
        filename,
        path: relativeDest,
        type: "folder"
      });

      await File.insertMany(logs);

      return res.status(200).json({ message: 'Directory copied successfully and logged' });

    } else {
      await fs.copyFile(src, dest);

      await File.create({
        owner: req.user.id,
        filename,
        path: relativeDest,
        type: "file",
      });

      return res.status(200).json({ message: 'File copied successfully and logged' });
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Source path not found' });
    }
    return res.status(500).json({ error: 'Failed to copy path', details: err.message });
  }
};





export const movePath = async (req, res) => {
  const { sourcePath, destinationPath, recursive = false } = req.body;

  if (!sourcePath || !destinationPath) {
    return res.status(400).json({ error: 'sourcePath and destinationPath are required' });
  }

  const src = path.resolve(BASE_DIR, sourcePath);
  const dest = path.resolve(BASE_DIR, destinationPath);
  const relDest = toUnixPath(path.relative(BASE_DIR, dest));
  const filename = path.basename(destinationPath);

  try {
    const stat = await fs.stat(src);

    if (stat.isDirectory()) {
      if (!recursive) {
        return res.status(400).json({ error: 'Use recursive: true to move directories' });
      }

      // Move locally
      await fs.cp(src, dest, { recursive: true });
      await fs.rm(src, { recursive: true });

      // Delete old entries
      const relSrc = toUnixPath(path.relative(BASE_DIR, src));
      await File.deleteMany({
        owner: req.user.id,
        path: { $regex: `^${relSrc}` }
      });

      // Log new entries using walkAndLog
      const newEntries = await walkAndLog(dest, req.user.id, true);

      for (const item of newEntries) {
        await File.findOneAndUpdate(
          { owner: req.user.id, path: item.path },
          item,
          { upsert: true, new: true }
        );
      }

      return res.status(200).json({ message: "Folder moved and MongoDB updated" });
    } else {
      await fs.copyFile(src, dest);
      await fs.unlink(src);

      const existing = await File.findOne({
        owner: req.user.id,
        filename,
        type: "file"
      });

      if (existing) {
        await File.updateOne({ _id: existing._id }, { $set: { path: relDest } });
      } else {
        await File.create({
          owner: req.user.id,
          filename,
          path: relDest,
          type: "file",
        });
      }

      return res.status(200).json({ message: "File moved and MongoDB updated" });
    }

  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Source path not found' });
    }
    return res.status(500).json({ error: 'Failed to move path', details: err.message });
  }
};
