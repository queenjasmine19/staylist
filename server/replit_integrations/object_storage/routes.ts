import type { Express } from "express";
import multer from "multer";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { isAuthenticated } from "../auth";

export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.post("/api/uploads/request-url", isAuthenticated, async (req: any, res) => {
    try {
      const { name, size, contentType } = req.body;
      if (!name || !contentType) {
        return res.status(400).json({ error: "Missing required fields: name, contentType" });
      }
      if (size && size > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
      }
      const result = await objectStorageService.getObjectEntityUploadURLWithPath();
      res.json({ uploadURL: result.uploadURL, objectPath: result.objectPath });
    } catch (error: any) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: error.message || "Failed to generate upload URL" });
    }
  });

  app.post("/api/uploads/direct", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      try {
        const objectPath = await objectStorageService.uploadBuffer(req.file.buffer, req.file.mimetype);
        res.json({ objectPath });
      } catch (storageError) {
        console.error("Object storage upload failed:", storageError);
        if (req.file.size <= 5 * 1024 * 1024) {
          const base64 = req.file.buffer.toString("base64");
          const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
          res.json({ objectPath: dataUrl });
        } else {
          res.status(500).json({ error: "Upload failed. Please try with a smaller image (under 5MB)." });
        }
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/*objectPath", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

