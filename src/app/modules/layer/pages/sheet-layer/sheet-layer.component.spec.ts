import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SheetLayerComponent } from './sheet-layer.component';

describe('SheetLayerComponent', () => {
  let component: SheetLayerComponent;
  let fixture: ComponentFixture<SheetLayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SheetLayerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SheetLayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
