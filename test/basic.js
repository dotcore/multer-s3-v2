/* eslint-env mocha */

const multerS3 = require('../')

const fs = require('fs')
const path = require('path')
const extend = require('xtend')
const assert = require('assert')
const multer = require('multer')
const stream = require('stream')
const FormData = require('form-data')
const onFinished = require('on-finished')
const mockS3 = require('./util/mock-s3')

const defaultTransforms = () => new stream.PassThrough()

const VALID_OPTIONS = {
  bucket: 'string',
  transforms: defaultTransforms
}

const INVALID_OPTIONS = [
  ['numeric key', { key: 1337 }],
  ['string key', { key: 'string' }],
  ['numeric bucket', { bucket: 1337 }],
  ['numeric contentType', { contentType: 1337 }],
  ['transform is undefined', { transform: undefined }]
]

function submitForm (multer, form, cb) {
  form.getLength(function (err, length) {
    if (err) return cb(err)

    const req = new stream.PassThrough()

    req.complete = false
    form.once('end', function () {
      req.complete = true
    })

    form.pipe(req)
    req.headers = {
      'content-type': 'multipart/form-data; boundary=' + form.getBoundary(),
      'content-length': length
    }

    multer(req, null, function (err) {
      onFinished(req, function () { cb(err, req) })
    })
  })
}

describe('Multer S3', function () {
  it('is exposed as a function', function () {
    assert.strict.equal(typeof multerS3, 'function')
  })

  INVALID_OPTIONS.forEach(function (testCase) {
    it('throws when given ' + testCase[0], function () {
      function testBody () {
        multerS3(extend(VALID_OPTIONS, testCase[1]))
      }

      assert.throws(testBody, TypeError)
    })
  })

  it('upload files', function (done) {
    const s3 = mockS3()
    const form = new FormData()
    const storage = multerS3({ s3: s3, bucket: 'test' })
    const upload = multer({ storage: storage })
    const parser = upload.single('image')
    const image = fs.createReadStream(path.join(__dirname, 'files', 'ffffff.png'))

    form.append('name', 'Multer')
    form.append('image', image)

    submitForm(parser, form, function (err, req) {
      assert.ifError(err)

      assert.strict.equal(req.body.name, 'Multer')

      assert.strict.equal(req.file.fieldname, 'image')
      assert.strict.equal(req.file.originalname, 'ffffff.png')
      assert.strict.equal(req.file.size, 68)
      assert.strict.equal(req.file.bucket, 'test')
      assert.strict.equal(req.file.etag, 'mock-etag')
      assert.strict.equal(req.file.location, 'mock-location')

      done()
    })
  })

  it('uploads file with AES256 server-side encryption', function (done) {
    const s3 = mockS3()
    const form = new FormData()
    const storage = multerS3({ s3: s3, bucket: 'test', serverSideEncryption: 'AES256' })
    const upload = multer({ storage: storage })
    const parser = upload.single('image')
    const image = fs.createReadStream(path.join(__dirname, 'files', 'ffffff.png'))

    form.append('name', 'Multer')
    form.append('image', image)

    submitForm(parser, form, function (err, req) {
      assert.ifError(err)

      assert.strict.equal(req.body.name, 'Multer')

      assert.strict.equal(req.file.fieldname, 'image')
      assert.strict.equal(req.file.originalname, 'ffffff.png')
      assert.strict.equal(req.file.size, 68)
      assert.strict.equal(req.file.bucket, 'test')
      assert.strict.equal(req.file.etag, 'mock-etag')
      assert.strict.equal(req.file.location, 'mock-location')
      assert.strict.equal(req.file.serverSideEncryption, 'AES256')

      done()
    })
  })

  it('uploads file with AWS KMS-managed server-side encryption', function (done) {
    const s3 = mockS3()
    const form = new FormData()
    const storage = multerS3({ s3: s3, bucket: 'test', serverSideEncryption: 'aws:kms' })
    const upload = multer({ storage: storage })
    const parser = upload.single('image')
    const image = fs.createReadStream(path.join(__dirname, 'files', 'ffffff.png'))

    form.append('name', 'Multer')
    form.append('image', image)

    submitForm(parser, form, function (err, req) {
      assert.ifError(err)

      assert.strict.equal(req.body.name, 'Multer')

      assert.strict.equal(req.file.fieldname, 'image')
      assert.strict.equal(req.file.originalname, 'ffffff.png')
      assert.strict.equal(req.file.size, 68)
      assert.strict.equal(req.file.bucket, 'test')
      assert.strict.equal(req.file.etag, 'mock-etag')
      assert.strict.equal(req.file.location, 'mock-location')
      assert.strict.equal(req.file.serverSideEncryption, 'aws:kms')

      done()
    })
  })

  it('uploads PNG file with correct content-type', function (done) {
    const s3 = mockS3()
    const form = new FormData()
    const storage = multerS3({ s3: s3, bucket: 'test', serverSideEncryption: 'aws:kms', contentType: multerS3.AUTO_CONTENT_TYPE })
    const upload = multer({ storage: storage })
    const parser = upload.single('image')
    const image = fs.createReadStream(path.join(__dirname, 'files', 'ffffff.png'))

    form.append('name', 'Multer')
    form.append('image', image)

    submitForm(parser, form, function (err, req) {
      assert.ifError(err)

      assert.strict.equal(req.body.name, 'Multer')

      assert.strict.equal(req.file.fieldname, 'image')
      assert.strict.equal(req.file.contentType, 'image/png')
      assert.strict.equal(req.file.originalname, 'ffffff.png')
      assert.strict.equal(req.file.size, 68)
      assert.strict.equal(req.file.bucket, 'test')
      assert.strict.equal(req.file.etag, 'mock-etag')
      assert.strict.equal(req.file.location, 'mock-location')
      assert.strict.equal(req.file.serverSideEncryption, 'aws:kms')

      done()
    })
  })

  it('does not upload a binary file with incorrect content-type when option "throwMimeTypeConflictErrors" is true', function (done) {
    const s3 = mockS3()
    const form = new FormData()
    const storage = multerS3({ s3: s3, bucket: 'test', serverSideEncryption: 'aws:kms', contentType: multerS3.AUTO_CONTENT_TYPE, throwMimeTypeConflictErrors: true })
    const upload = multer({ storage: storage })
    const parser = upload.single('image')
    const image = fs.createReadStream(path.join(__dirname, 'files', 'actually-a-png.pdf'))

    form.append('name', 'Multer')
    form.append('image', image)

    submitForm(parser, form, function (err, req) {
      assert.strict.equal(err.message, 'MIMETYPE_MISMATCH: Actual content-type "image/png" does not match the mime-type "application/pdf" assumed by the file extension for file "actually-a-png.pdf"')
      done()
    })
  })

  it('does upload a file with content-type "application/octet-stream" and correct file-extension when option "throwMimeTypeConflictErrors" is true', function (done) {
    const s3 = mockS3()
    const form = new FormData()
    const storage = multerS3({ s3: s3, bucket: 'test', serverSideEncryption: 'aws:kms', contentType: multerS3.AUTO_CONTENT_TYPE, throwMimeTypeConflictErrors: true })
    const upload = multer({ storage: storage })
    const parser = upload.single('file')
    const image = fs.createReadStream(path.join(__dirname, 'files', 'test.txt'))

    form.append('name', 'Multer')
    form.append('file', image)

    submitForm(parser, form, function (err, req) {
      assert.ifError(err)

      assert.strict.equal(req.body.name, 'Multer')

      assert.strict.equal(req.file.fieldname, 'file')
      assert.strict.equal(req.file.contentType, 'application/octet-stream')
      assert.strict.equal(req.file.originalname, 'test.txt')
      assert.strict.equal(req.file.size, 5)
      assert.strict.equal(req.file.bucket, 'test')
      assert.strict.equal(req.file.etag, 'mock-etag')
      assert.strict.equal(req.file.location, 'mock-location')
      assert.strict.equal(req.file.serverSideEncryption, 'aws:kms')

      done()
    })
  })

  it('uploads SVG file with correct content-type', function (done) {
    const s3 = mockS3()
    const form = new FormData()
    const storage = multerS3({ s3: s3, bucket: 'test', serverSideEncryption: 'aws:kms', contentType: multerS3.AUTO_CONTENT_TYPE })
    const upload = multer({ storage: storage })
    const parser = upload.single('image')
    const image = fs.createReadStream(path.join(__dirname, 'files', 'test.svg'))

    form.append('name', 'Multer')
    form.append('image', image)

    submitForm(parser, form, function (err, req) {
      assert.ifError(err)

      assert.strict.equal(req.body.name, 'Multer')

      assert.strict.equal(req.file.fieldname, 'image')
      assert.strict.equal(req.file.contentType, 'image/svg+xml')
      assert.strict.equal(req.file.originalname, 'test.svg')
      assert.strict.equal(req.file.size, 100)
      assert.strict.equal(req.file.bucket, 'test')
      assert.strict.equal(req.file.etag, 'mock-etag')
      assert.strict.equal(req.file.location, 'mock-location')
      assert.strict.equal(req.file.serverSideEncryption, 'aws:kms')

      done()
    })
  })

  it('uploads file with single function transform', function (done) {
    const s3 = mockS3()
    const form = new FormData()
    const storage = multerS3({ s3: s3, bucket: 'test', serverSideEncryption: 'aws:kms', contentType: multerS3.AUTO_CONTENT_TYPE, transforms: defaultTransforms })
    const upload = multer({ storage: storage })
    const parser = upload.single('image')
    const image = fs.createReadStream(path.join(__dirname, 'files', 'test.svg'))

    form.append('name', 'Multer')
    form.append('image', image)

    submitForm(parser, form, function (err, req) {
      assert.ifError(err)

      assert.strict.equal(req.body.name, 'Multer')

      assert.strict.equal(req.file.fieldname, 'image')
      assert.strict.equal(req.file.contentType, 'image/svg+xml')
      assert.strict.equal(req.file.originalname, 'test.svg')
      assert.strict.equal(req.file.size, 100)
      assert.strict.equal(req.file.bucket, 'test')
      assert.strict.equal(req.file.etag, 'mock-etag')
      assert.strict.equal(req.file.location, 'mock-location')
      assert.strict.equal(req.file.serverSideEncryption, 'aws:kms')

      done()
    })
  })

  it('uploads file with field specific transform', function (done) {
    const transforms = {
      image: defaultTransforms
    }

    const s3 = mockS3()
    const form = new FormData()
    const storage = multerS3({ s3: s3, bucket: 'test', serverSideEncryption: 'aws:kms', contentType: multerS3.AUTO_CONTENT_TYPE, transforms })
    const upload = multer({ storage: storage })
    const parser = upload.single('image')
    const image = fs.createReadStream(path.join(__dirname, 'files', 'test.svg'))

    form.append('name', 'Multer')
    form.append('image', image)

    submitForm(parser, form, function (err, req) {
      assert.ifError(err)

      assert.strict.equal(req.body.name, 'Multer')

      assert.strict.equal(req.file.fieldname, 'image')
      assert.strict.equal(req.file.contentType, 'image/svg+xml')
      assert.strict.equal(req.file.originalname, 'test.svg')
      assert.strict.equal(req.file.size, 100)
      assert.strict.equal(req.file.bucket, 'test')
      assert.strict.equal(req.file.etag, 'mock-etag')
      assert.strict.equal(req.file.location, 'mock-location')
      assert.strict.equal(req.file.serverSideEncryption, 'aws:kms')

      done()
    })
  })
})
