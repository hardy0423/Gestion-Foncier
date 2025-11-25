import {
    Feature,
} from 'src/app/ol-module';

/**
 * Gerer des données: quelques fonctions génériqus
 * 
 **/
export class handleDataHelper {
    /**
     * Ajouter un feature dans un tableau: si le feature existe déja, le retirer puis l'ajouter
     * @param features Array<Feature>
     * @param feature Feature
     * @return Array<Feature>
     */

    public static  pushFeatureInArray(features:Array<Feature>,feature:Feature):Array<Feature>{
        var indexArray = -1
        for (let index = 0; index < features.length; index++) {
            const element = features[index];
            if (element.getId() == feature.getId()) {
                indexArray = index
            }
        }

        if (indexArray >= 0) {
            features.splice(indexArray,1)
        }

        features.push(feature)

        return features
    }

    public static makeid() {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      
        for (var i = 0; i < 5; i++)
          text += possible.charAt(Math.floor(Math.random() * possible.length));
      
        return text;
      }
}