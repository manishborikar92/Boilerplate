const mongoose = require('mongoose');
const Folder = require('../../src/models/Folder');

describe('Folder model', () => {
  const firmId = new mongoose.Types.ObjectId();
  const clientId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  afterEach(async () => {
    await Folder.deleteMany({});
  });

  it('provides categoryName virtual', async () => {
    const folder = await Folder.create({
      name: 'GST',
      category: 'GST_Filings',
      clientId,
      firmId,
      createdBy: userId
    });
    expect(folder.categoryName).toBe('GST Filings');
  });

  it('increments and decrements document counts', async () => {
    const folder = await Folder.create({
      name: 'Docs',
      clientId,
      firmId,
      createdBy: userId
    });

    await folder.incrementDocumentCount();
    const updated = await Folder.findById(folder._id);
    expect(updated.documentCount).toBe(1);

    await updated.decrementDocumentCount();
    const updatedAgain = await Folder.findById(folder._id);
    expect(updatedAgain.documentCount).toBe(0);
  });

  it('soft deletes folder', async () => {
    const folder = await Folder.create({
      name: 'Archive',
      clientId,
      firmId,
      createdBy: userId
    });

    await folder.softDelete(userId);
    const deleted = await Folder.findById(folder._id);
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.deletedBy.toString()).toBe(userId.toString());
  });

  it('finds active folders by client and category', async () => {
    const folderA = await Folder.create({
      name: 'A',
      clientId,
      firmId,
      createdBy: userId,
      category: 'Income_Tax'
    });
    const folderB = await Folder.create({
      name: 'B',
      clientId,
      firmId,
      createdBy: userId,
      category: 'Income_Tax'
    });
    await folderB.softDelete(userId);

    const active = await Folder.findActive({ firmId });
    expect(active.length).toBe(1);

    const byClient = await Folder.findByClient(clientId);
    expect(byClient.length).toBe(1);

    const byCategory = await Folder.findByClientAndCategory(clientId, 'Income_Tax');
    expect(byCategory.length).toBe(1);
    expect(byCategory[0]._id.toString()).toBe(folderA._id.toString());
  });

  it('stores hierarchy metadata for nested folders', async () => {
    const parent = await Folder.create({
      name: 'FY 2025-26',
      clientId,
      firmId,
      createdBy: userId
    });

    const child = await Folder.create({
      name: '  GST Returns  ',
      clientId,
      firmId,
      createdBy: userId,
      parentId: parent._id,
      ancestorIds: [parent._id],
      depth: 1
    });

    expect(child.parentId.toString()).toBe(parent._id.toString());
    expect(child.ancestorIds.map((id) => id.toString())).toEqual([parent._id.toString()]);
    expect(child.depth).toBe(1);
    expect(child.normalizedName).toBe('gst returns');
    expect(child.childFolderCount).toBe(0);
    expect(child.directDocumentCount).toBe(0);
  });

  it('enforces duplicate names within the same parent only', async () => {
    const parentA = await Folder.create({
      name: 'Parent A',
      clientId,
      firmId,
      createdBy: userId
    });

    const parentB = await Folder.create({
      name: 'Parent B',
      clientId,
      firmId,
      createdBy: userId
    });

    await Folder.create({
      name: 'Tax Docs',
      clientId,
      firmId,
      createdBy: userId,
      parentId: parentA._id,
      ancestorIds: [parentA._id],
      depth: 1
    });

    await expect(
      Folder.create({
        name: ' tax docs ',
        clientId,
        firmId,
        createdBy: userId,
        parentId: parentA._id,
        ancestorIds: [parentA._id],
        depth: 1
      })
    ).rejects.toThrow();

    await expect(
      Folder.create({
        name: 'Tax Docs',
        clientId,
        firmId,
        createdBy: userId,
        parentId: parentB._id,
        ancestorIds: [parentB._id],
        depth: 1
      })
    ).resolves.toBeDefined();
  });
});
