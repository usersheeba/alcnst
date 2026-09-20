/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { openDB, IDBPDatabase } from 'idb';
import { Project, ScreenplayDocument, ProseDocument, JournalEntry } from '../types';

const DB_NAME = 'screenplay_prose_studio_v1';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'metadata.id' });
        }
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('journal')) {
          db.createObjectStore('journal', { keyPath: 'id' });
        }
      },
    }).catch((err) => {
      console.warn('IndexedDB initialization failed, falling back to storage shim', err);
      return null as any;
    });
  }
  return dbPromise;
}

// Memory fallback in case IndexedDB is restricted in sandbox
const memoryProjects: Map<string, Project> = new Map();
const memoryDocuments: Map<string, ScreenplayDocument | ProseDocument> = new Map();
const memoryJournal: JournalEntry[] = [];

export async function saveProject(project: Project): Promise<void> {
  memoryProjects.set(project.metadata.id, JSON.parse(JSON.stringify(project)));
  try {
    const db = await getDB();
    if (db) {
      await db.put('projects', project);
    }
  } catch (err) {
    console.warn('saveProject IndexedDB error:', err);
  }
}

export async function loadProject(projectId: string): Promise<Project | null> {
  try {
    const db = await getDB();
    if (db) {
      const res = await db.get('projects', projectId);
      if (res) return res;
    }
  } catch (err) {
    console.warn('loadProject IndexedDB error:', err);
  }
  return memoryProjects.get(projectId) || null;
}

export async function listProjects(): Promise<Project[]> {
  try {
    const db = await getDB();
    if (db) {
      const res = await db.getAll('projects');
      if (res && res.length > 0) return res;
    }
  } catch (err) {
    console.warn('listProjects IndexedDB error:', err);
  }
  return Array.from(memoryProjects.values());
}

export async function deleteProject(projectId: string): Promise<void> {
  memoryProjects.delete(projectId);
  try {
    const db = await getDB();
    if (db) {
      await db.delete('projects', projectId);
    }
  } catch (err) {
    console.warn('deleteProject IndexedDB error:', err);
  }
}

export async function saveDocument(doc: ScreenplayDocument | ProseDocument): Promise<void> {
  memoryDocuments.set(doc.id, JSON.parse(JSON.stringify(doc)));
  try {
    const db = await getDB();
    if (db) {
      await db.put('documents', doc);
    }
  } catch (err) {
    console.warn('saveDocument IndexedDB error:', err);
  }
}

export async function loadDocument(docId: string): Promise<ScreenplayDocument | ProseDocument | null> {
  try {
    const db = await getDB();
    if (db) {
      const res = await db.get('documents', docId);
      if (res) return res;
    }
  } catch (err) {
    console.warn('loadDocument IndexedDB error:', err);
  }
  return memoryDocuments.get(docId) || null;
}

export async function deleteDocument(docId: string): Promise<void> {
  memoryDocuments.delete(docId);
  try {
    const db = await getDB();
    if (db) {
      await db.delete('documents', docId);
    }
  } catch (err) {
    console.warn('deleteDocument IndexedDB error:', err);
  }
}

export async function appendJournal(entry: JournalEntry): Promise<void> {
  memoryJournal.push(entry);
  try {
    const db = await getDB();
    if (db) {
      await db.put('journal', entry);
    }
  } catch (err) {
    console.warn('appendJournal IndexedDB error:', err);
  }
}
