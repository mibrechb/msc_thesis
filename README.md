# <img src="https://drive.google.com/uc?id=1XN1lMrKKPZRqkko8NCM4IaoS5apzWAO1" width="40"> licmonitoring.com repository 

This is the code repository for the the MSc thesis "***Multi-sensor lake ice monitoring in the European Alps using the Google Earth Engine***" by Michael Brechbühler of the Departement of Geography at the University of Zurich. This repository contains all the main scripts used in the thesis. For more information please visit [licmonitoring.com](https://www.licmonitoring.com).

## folder structure

* gee
  * **Training Polygon Generator (xx).js**    (Training polygon generator, based on coarse-classification or manual (S-2))
  * **Training Data Generator (xx).js**       (Training samples generator, based on training polygons)
  * **xx Toolbox.js**                         (Toolbox with sensor-specific functions)
  * **Classifier (xx, modular).js**           (Sensor-specific classifier)
  * **licmonitoring_app.js**                  (GEE app)
  * **K-Fold Cross Validation.js**            (K-fold cross-validation)
  * **RF - Multiparameter tuning.js**         (Multiparameter grid-tuning)
  * **Lake Shadow Coverage.js**               (Topographic lake shadow extractor)

* trainingsets
  * **trainingset_xx.zip**                    (Full training set with samples used for model training and validation)
