import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FullscreenService {
  // Observable for fullScreen
  private fullscreenSubject = new BehaviorSubject<boolean>(false);
  fullscreen$ = this.fullscreenSubject.asObservable();

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  updateFullscreenState(isFullscreen: boolean) {
    this.fullscreenSubject.next(isFullscreen);
  }
}