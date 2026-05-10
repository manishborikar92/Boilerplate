export class BaseRepository {
  constructor(model) {
    if (!model) {
      throw new Error('BaseRepository requires a Mongoose model');
    }

    this.model = model;
  }

  create(data, options = {}) {
    return this.model.create([data], options).then(([document]) => document);
  }

  findById(id, options = {}) {
    return this.model.findById(id, null, options);
  }

  findOne(filter = {}, options = {}) {
    return this.model.findOne(filter, null, options);
  }

  findMany(filter = {}, options = {}) {
    return this.model.find(filter, null, options);
  }

  updateById(id, data, options = {}) {
    return this.model.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true, ...options },
    );
  }

  deleteById(id, options = {}) {
    return this.model.findByIdAndDelete(id, options);
  }
}
