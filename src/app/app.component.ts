import { Component, HostListener } from "@angular/core";

import { registerLocaleData } from "@angular/common";
import localeFr from "@angular/common/locales/fr";
import { FullscreenService } from "./data/services/fullscreen.service";

registerLocaleData(localeFr, "fr");
@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent {
  title = "ABM";

  constructor(private fullscreenService: FullscreenService) {}

  ngOnInit() {
    document.addEventListener('fullscreenchange', () => {
      this.fullscreenService.updateFullscreenState(!!document.fullscreenElement);
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (event.key === 'F11') {
      event.preventDefault();
      this.fullscreenService.toggleFullscreen();
    }
  }
}
