const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema({
  owner: {
    type: String,
    required: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  repoUrl: {
    type: String,
    required: true,
    trim: true,
  },
  defaultBranch: {
    type: String,
    default: 'main',
  },
  lastAnalyzedCommit: {
    type: String,
    default: null,
  },
  lastScore: {
    type: Number,
    default: null,
  },
  isPrivate: {
    type: Boolean,
    default: false,
  },
  description: {
    type: String,
    default: '',
  },
  stars: {
    type: Number,
    default: 0,
  },
  forks: {
    type: Number,
    default: 0,
  },
  fullName: {
    type: String,
    trim: true,
  },
  totalAnalyses: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

repositorySchema.pre('save', function (next) {
  if (!this.fullName && this.owner && this.name) {
    this.fullName = `${this.owner}/${this.name}`;
  }
  this.updatedAt = Date.now();
  next();
});

repositorySchema.index({ fullName: 1 }, { unique: true });

module.exports = mongoose.model('Repository', repositorySchema);
