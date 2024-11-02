mod utils;
mod create_bindings;

use std::rc::Rc;

use const_format::concatcp;
use diffsol::{diffsl::CraneliftModule, error::DiffsolError, DiffSl, Bdf, DiffSlContext, NalgebraLU, NewtonNonlinearSolver, OdeBuilder, OdeSolverProblem, SparseColMat, Op, Sdirk};
use js_sys::{Array, Float64Array};
use nalgebra::{DMatrix, DVector};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    alert("Hello, diffsol-js!");
}

#[wasm_bindgen(js_name = DiffsolError)]
pub struct JsDiffsolError(DiffsolError);

#[wasm_bindgen(js_name = OdeBuilder)]
struct JsOdeBuilder(OdeBuilder);

#[wasm_bindgen(js_class = OdeBuilder)]
impl JsOdeBuilder {
    #[wasm_bindgen(constructor)]
    pub fn new() -> JsOdeBuilder {
        JsOdeBuilder(OdeBuilder::new())
    }

    pub fn t0(self, t0: f64) -> JsOdeBuilder {
        JsOdeBuilder(self.0.t0(t0))
    }

    pub fn h0(self, h0: f64) -> JsOdeBuilder {
        JsOdeBuilder(self.0.h0(h0))
    }
}

struct TwoTuple(pub Array, Float64Array);




create_binding!(nalgebra_dense_lu_f64, DiffSl<DMatrix<f64>, CraneliftModule>, NalgebraLU<f64>);





