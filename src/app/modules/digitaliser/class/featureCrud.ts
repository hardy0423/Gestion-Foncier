import { Feature } from "ol";
import { Geometry, VectorLayer, VectorSource } from "src/app/ol-module";
import { FeatureStatus } from "../../../data/models/layer-to-digitalise";

export function initialiseSourceForDigitaliser(source: VectorSource) {
    let FMAPfeatures: Array<FeatureStatus> = source.getFeatures().map((feature) => {
        return {
            id: feature.getId(),
            updateAttribute: false,
            updateGeometry: false,
            deleted: false,
            new: false
        }
    })
    source.set('FMAPfeatures', FMAPfeatures)
}

export function updateAttributeFeature(layer: VectorLayer<VectorSource<Geometry>>, feature: Feature) {
    let FMAPfeatures: Array<any> = layer.getSource().get('FMAPfeatures')

    FMAPfeatures.filter((item) => item.id == feature.getId()).map((item: FeatureStatus) => {
        item.updateAttribute = true
    })

    layer.getSource().set('FMAPfeatures', FMAPfeatures)
}

export function updateGeometryFeature(layer: VectorLayer<VectorSource<Geometry>>, feature: Feature) {
    let FMAPfeatures: Array<any> = layer.getSource().get('FMAPfeatures')

    FMAPfeatures.filter((item) => item.id == feature.getId()).map((item: FeatureStatus) => {
        item.updateGeometry = true
    })

    layer.getSource().set('FMAPfeatures', FMAPfeatures)
}

export function deleteFeature(layer: VectorLayer<VectorSource<Geometry>>, feature: Feature) {
    let FMAPfeatures: Array<any> = layer.getSource().get('FMAPfeatures')

    FMAPfeatures.filter((item) => item.id == feature.getId()).map((item: FeatureStatus) => {
        item.deleted = true
    })

    layer.getSource().set('FMAPfeatures', FMAPfeatures)
    layer.getSource().changed()
}

export function addFeature(layer: VectorLayer<VectorSource<Geometry>>, feature: Feature) {
    layer.getSource().get('FMAPfeatures').push(({
        id: feature.getId(),
        updateAttribute: false,
        updateGeometry: false,
        deleted: false,
        new: true
    }))
    // let FMAPfeatures:Array<FeatureStatus> = layer.getSource().get('FMAPfeatures')
    // layer.getSource().set('FMAPfeatures',FMAPfeatures)
}

/**
 * get all feature that have been added
 * @param layer VectorLayer<VectorSource<Geometry>>
 * @returns 
 */
export function getAllAddFeatureFromLayer(layer: VectorLayer<VectorSource<Geometry>>): Array<Feature> {
    let FMAPfeatures: Array<FeatureStatus> = layer.getSource().get('FMAPfeatures')
    return layer.getSource().getFeatures().filter((feature) => {
        let featureStatus = FMAPfeatures.find((ff) => ff.id === feature.getId())
        if (featureStatus) {
            if (featureStatus.new === true && featureStatus.deleted === false) {
                return true
            }
        }
        return false
    })
}

/**
 * get all feature that have been deleted
 * @param layer VectorLayer
 * @returns 
 */
export function getAllDeletedFeatureFromLayer(layer: VectorLayer<VectorSource<Geometry>>): Array<Feature> {
    let FMAPfeatures: Array<FeatureStatus> = layer.getSource().get('FMAPfeatures')
    return layer.getSource().getFeatures().filter((feature) => {
        let featureStatus = FMAPfeatures.find((ff) => ff.id === feature.getId())
        if (featureStatus) {
            if (featureStatus.new === false && featureStatus.deleted === true) {
                return true
            }
        }
        return false
    })
}

/**
 * get all feature that have been updated attribute or geometry
 * @param layer VectorLayer<VectorSource<Geometry>>
 * @returns 
 */
export function getAllUpdatedFeatureFromLayer(layer: VectorLayer<VectorSource<Geometry>>): Array<Feature> {
    let FMAPfeatures: Array<FeatureStatus> = layer.getSource().get('FMAPfeatures')
    return layer.getSource().getFeatures().filter((feature) => {
        let featureStatus = FMAPfeatures.find((ff) => ff.id === feature.getId())
        if (featureStatus) {
            if (featureStatus.new === false && featureStatus.deleted === false && (featureStatus.updateAttribute == true || featureStatus.updateGeometry == true)) {
                return true
            }
        }
        return false
    })
}