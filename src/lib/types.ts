export type User = {
  id: string;
  email: string;
  name: string;
};

export type Permission = "view" | "edit";

export type Document = {
  id: string;
  title: string;
  content: string; // Tiptap HTML
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentListItem = Document & {
  ownerName: string;
  ownerEmail: string;
  /** Non-null only when the current viewer is a share recipient. */
  sharedPermission?: Permission;
};

export type ShareEntry = {
  userId: string;
  email: string;
  name: string;
  permission: Permission;
  createdAt: string;
};

export type Attachment = {
  id: string;
  documentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type DocumentAccess = {
  document: Document;
  role: "owner" | Permission;
};
