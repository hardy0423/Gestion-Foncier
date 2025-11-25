import * as $ from 'jquery'
/**
 * helper to know if we are on tablet, phone or dekstop
 */
export class ScreenHelper{
    constructor(){

    }

    /**
     * get platform
     */
    static getPlatform():'phone'|'dekstop'{
        if ($(window).width() <= 450) {
            return 'phone'
        }else{
            return 'dekstop'
        }
    }
}