const Campground = require('../models/campground');
const {cloudinary} = require('../cloudinary');
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mbxToken = process.env.MAPBOX_TOKEN;

const geocoder = mbxGeocoding({accessToken: mbxToken})

module.exports.renderIndex = async (req, res, next) => {
	const campgrounds = await Campground.find({});
	res.render('campgrounds/index', {campgrounds});
}

module.exports.renderNewForm = (req, res) => {
	res.render('campgrounds/new');
}

module.exports.createNewCamp = async (req, res, next) => {
	// Server-side validation OPTION 1: dataCheck.js - self-made
	// dataCheck customizes responses depending on the missing data from the client
	
	// dataCheck(req.body);

	// Server-side validation OPTION 2: Joi API - via NPM
	// see middleware inside the router.post call above (2nd parameter is the error middleware)

	const geoResult = await geocoder.forwardGeocode({
		query: req.body.location,
		limit: 1
	}).send();

	const campground = new Campground({	...req.body, author: req.user._id});
	campground.images = req.files.map(f => ({path: f.path, filename: f.filename}) );
	campground.geometry = geoResult.body.features[0].geometry;
	console.log(campground.geometry);
	await campground.save();
	req.flash('success', 'Created a new Campground!');
	res.redirect(`campgrounds/${campground._id}`);
}

module.exports.showCamp = async (req, res) => {
	const campground = await Campground.findById(req.params.id)
		.populate({path: 'reviews', populate: {path: 'author'}})
		.populate('author');
	if (!campground) {
		req.flash('error', `Cannot find campground "${req.params.id}"`);
		return res.redirect('/campgrounds');
	}
	res.render('campgrounds/show', {campground});
}

module.exports.renderEditForm = async (req, res) => {
	const campground = await Campground.findById(req.params.id);
	if (!campground) {
		req.flash('error', `Cannot find campground "${req.params.id}"`);
		return res.redirect('/campgrounds');
	}
	res.render('campgrounds/edit', {campground});
}

module.exports.editCamp = async (req, res) => {
	const {id} = req.params;
	// console.log(req.body);
	// const {title, location} = req.body;
	// const campground = await Campground.findByIdAndUpdate(id, {title: title, location: location}, {new: true});
	const geoResult = await geocoder.forwardGeocode({
		query: req.body.location,
		limit: 1
	}).send();
	// console.log(req.body.deleteImages);
	const imgs = req.files.map(f => ({path: f.path, filename: f.filename}) );
	const campground = await Campground.findByIdAndUpdate(id, req.body, {new: true});
	campground.geometry = geoResult.body.features[0].geometry;
	console.log(campground.geometry);	
	campground.images.push(...imgs);
	await campground.save();
	if (req.body.deleteImages) {
		for(let filename of req.body.deleteImages){
			await cloudinary.uploader.destroy(filename);
		}
		await campground.updateOne({$pull: {images: {filename: {$in: req.body.deleteImages} } } } );
		// console.log(campground.images);
	}
	req.flash('success', `Successfully edited campground "${campground.title}"`);
	res.redirect(`/campgrounds/${id}`);
}

module.exports.deleteCamp = async (req, res) => {
	const {id} = req.params;
	const deletedCampground = await Campground.findByIdAndDelete(id);
	req.flash('success', `Successfully deleted campground "${deletedCampground.title}"`);
	res.redirect(`/campgrounds`);
}
// module.exports.