import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayerRightComponent } from './layer-right.component';

describe('LayerRightComponent', () => {
  let component: LayerRightComponent;
  let fixture: ComponentFixture<LayerRightComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LayerRightComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LayerRightComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
