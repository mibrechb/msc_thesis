exports.kFoldCrossValidation = function(inputtedFeatureCollection, k, classifierOfChoice, propertyToPredictAsString, bands) {
	/*
	K-Fold Cross Validation function, adapted from the original posted in the Google Earth Engine Developers Forum from Devin Routh
	
	Arguments:
	inputtedFeatureCollection: an ee.FeatureCollection() of sample points object with a property of interest
	imageToClassify: the image used to classify/regress the point samples
	k: the number of folds
	classifierOfChoice: the classifier/regressor of choice
	propertyToPredictAsString: the name of the property to predict as a string object
	
	Returns:
	- a feature collection of points with assigned random ID's, fold numbers,
	observed property of interest values, and predicted propery of interest values
	*/

	// ———————————————————————————————————————————————————————————————
	// The sections below are the function's code, beginning with
	// preparation of the inputted feature collection of sample points

  
	var collLength = inputtedFeatureCollection.size();
	// print('Number of Sample Points',collLength);

	var sampleSeq = ee.List.sequence(1, collLength);
	// print('Sample Sequence',sampleSeq);

	var inputtedFCWithRand = inputtedFeatureCollection.randomColumn('Rand_Num', 42).sort('Rand_Num').toList(collLength);
	// print('Total FC with Random Column',inputtedFCWithRand);

	// Prep the feature collection with random fold assignment numbers
	var preppedListOfFeats = sampleSeq.map(function(numberToSet) {
		return ee.Feature(inputtedFCWithRand.get(ee.Number(numberToSet).subtract(1))).set('Fold_ID', ee.Number(numberToSet));
	});
	// print('Prepped FC', preppedListOfFeats);




	// ———————————————————————————————————————————————————————————————
	// This section divides the feature collection into the k folds


	var averageFoldSize = collLength.divide(k).floor();
	// print('Average Fold Size',averageFoldSize);

	var remainingSampleSize = collLength.mod(k);
	// print('Remaining Sample Size', remainingSampleSize);

	var foldSequenceWithoutRemainder = ee.List.sequence(0, k - 1).map(function(fold) {
		var foldStart = ee.Number(fold).multiply(averageFoldSize).add(1);
		var foldEnd = ee.Number(foldStart).add(averageFoldSize.subtract(1));
		var foldNumbers = ee.List.sequence(foldStart, foldEnd);
		return ee.List(foldNumbers);
	});
	// print('Fold Sequence Without Remaining Samples',foldSequenceWithoutRemainder);

	var remainingFoldSequence = ee.List.sequence(ee.Number(ee.List(foldSequenceWithoutRemainder.get(foldSequenceWithoutRemainder.length().subtract(1))).get(averageFoldSize.subtract(1))).add(1),
		ee.Number(ee.List(foldSequenceWithoutRemainder.get(foldSequenceWithoutRemainder.length().subtract(1))).get(averageFoldSize.subtract(1))).add(ee.Number(remainingSampleSize)));
	// print('Remaining Fold Sequence',remainingFoldSequence);

	// This is a list of lists describing which features will go into each fold
	var listsWithRemaindersAdded = foldSequenceWithoutRemainder.zip(remainingFoldSequence).map(function(list) {
		return ee.List(list).flatten();
	});
	// print('Lists with Remainders Added',listsWithRemaindersAdded);

	var finalFoldLists = listsWithRemaindersAdded.cat(foldSequenceWithoutRemainder.slice(listsWithRemaindersAdded.length()));
	// print('Final Fold Lists Formatted',finalFoldLists);

	var mainFoldList = ee.List.sequence(0, k - 1);
	// print('Main Fold List',mainFoldList);

	// Make a feature collection with a number of null features equal to the number of folds
	// This is done to stay in a collection rather than moving to a list
	var nullFC = ee.FeatureCollection(mainFoldList.map(function(foldNumber) {
		return ee.Feature(null).set('foldNumberPrep', ee.Number(foldNumber));
	}));
	// print('Null FC',nullFC);

	// Use the null FC to filter and assign a fold number to each feature, then flatten it back to a collection
	var featuresWithFoldAssignments = nullFC.map(function(feature) {
		var featureNumbersInFold = finalFoldLists.get(ee.Feature(feature).get('foldNumberPrep'));
		var featuresWithFoldNumbers = ee.FeatureCollection(preppedListOfFeats).filter(ee.Filter.inList('Fold_ID', featureNumbersInFold))
			.map(function(f) {
				return f.set('Fold_Number', ee.Feature(feature).get('foldNumberPrep'));
			});
		return featuresWithFoldNumbers;
	}).flatten();
	
	//print('Sample of featurecollection with fold assignments',featuresWithFoldAssignments.first());


	// ———————————————————————————————————————————————————————————————
	// Train the data and retrieve the values at the sample points


	// Classify the images based on the training folds
	var validation = ee.FeatureCollection(nullFC.map(function(feature) {
		var trainingFold = ee.FeatureCollection(featuresWithFoldAssignments).filterMetadata('Fold_Number', 'not_equals', ee.Feature(feature).get('foldNumberPrep'));
		var validationFoldSamples = ee.FeatureCollection(featuresWithFoldAssignments).filterMetadata('Fold_Number', 'equals', ee.Feature(feature).get('foldNumberPrep'));
		var trainedClassifier = classifierOfChoice.train(trainingFold, propertyToPredictAsString, bands);
		var classifiedFoldSamples = validationFoldSamples.classify(trainedClassifier);
		var errorMatrix = classifiedFoldSamples.errorMatrix('class', 'classification')
		feature = feature.set({
      order: errorMatrix.order(),
      errorMatrix: errorMatrix,
      accuracy: errorMatrix.accuracy(),
      kappa: errorMatrix.kappa(),
      consumersAccuracy: errorMatrix.consumersAccuracy(),
      producerssAccuracy: errorMatrix.producersAccuracy()
		})
		return feature
	}));

  /*
	// Retrieve the validation data from the validation folds
	var validationResults = nullFC.map(function(feature) {
		var validationFoldSamples = ee.FeatureCollection(featuresWithFoldAssignments).filterMetadata('Fold_Number', 'equals', ee.Feature(feature).get('foldNumberPrep'));
		var validationResults = ee.FeatureCollection(validationFoldSamples).select([propertyToPredictAsString, 'Fold_Number', 'Fold_ID', 'Sample_Num'])
		return validationResults;
	});
	print('Validation Results',validationResults.first());

	var validationResultsFlattened = validationResults.flatten();
	print('Validation Results Flattened and Formatted',validationResultsFlattened);
	*/
	return(validation)
};
