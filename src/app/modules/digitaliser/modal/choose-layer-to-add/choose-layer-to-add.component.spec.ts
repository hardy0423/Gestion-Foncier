import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChooseLayerToAddComponent } from './choose-layer-to-add.component';

describe('ChooseLayerToAddComponent', () => {
  let component: ChooseLayerToAddComponent;
  let fixture: ComponentFixture<ChooseLayerToAddComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ChooseLayerToAddComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChooseLayerToAddComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
