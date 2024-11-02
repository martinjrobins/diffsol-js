use diffsol::{ode_solver::problem, DiffSl, DiffSlContext, OdeBuilder, OdeSolverProblem, OdeSolverState, OdeSolverMethod};
use js_sys::Float64Array;
use wasm_bindgen::prelude::*;
use super::*;
use crate::JsOdeBuilder;


#[wasm_bindgen(js_name = DIFFSL_NAME)]
pub struct JsDiffSl(Eqn);

#[wasm_bindgen(js_class = DIFFSL_NAME)]
impl JsDiffSl {
    #[wasm_bindgen(constructor)]
    pub fn new(code: &str) -> Result<JsDiffSl, JsDiffsolError> {
        DiffSlContext::new(code).map(|context| JsDiffSl(DiffSl::from_context(context)))
            .map_err(JsDiffsolError)
    }
}

#[wasm_bindgen(js_name = ODE_SOLVER_PROBLEM_NAME)]
pub struct JsOdeSolverProblem(OdeSolverProblem<Eqn>);

#[wasm_bindgen(js_class = ODE_SOLVER_PROBLEM_NAME)]
impl JsOdeSolverProblem {
    pub fn set_params(&mut self, p: &[T]) -> Result<(), JsDiffsolError> {
        let mut vp = V::zeros(p.len());
        vp.copy_from_slice(p);
        self.0.set_params(vp)
            .map_err(JsDiffsolError)
    }
}



#[wasm_bindgen(js_class = OdeBuilder)]
impl JsOdeBuilder {
    #[wasm_bindgen(js_name = MODULE_NAME)]
    pub fn build(self, code: &str) -> Result<JsOdeSolverProblem, JsDiffsolError> {
        let context = DiffSlContext::new(code).map_err(JsDiffsolError)?;
        let eqn = DiffSl::from_context(context);
        let problem = self.0.build_from_eqn(eqn).map_err(JsDiffsolError)?;
        Ok(JsOdeSolverProblem(problem))
    }
}

#[wasm_bindgen(js_name = BDF_SOLVER_NAME)]
pub struct JsBdf(Bdf<DM, Eqn, Nls>);

#[wasm_bindgen(js_name = BDF_SOLVER_NAME)]
pub struct JsBdf(Bdf<DM, Eqn, Nls>);



#[wasm_bindgen(js_class = BDF_SOLVER_NAME)]
impl JsBdf {
    #[wasm_bindgen(constructor)]
    pub fn default() -> JsBdf {
        JsBdf(Bdf::default())
    }
    
    pub fn solve(&mut self, problem: &JsOdeSolverProblem, t1: f64) -> Result<(Float64Array, Float64Array), JsDiffsolError> {
        let state = OdeSolverState::new(&problem.0, &self.0).map_err(JsDiffsolError)?;
        self.0.solve(&problem.0, state, t1).map_err(JsDiffsolError)
    }

}


#[wasm_bindgen(js_name = SDIRK_SOLVER_NAME)]
pub struct JsSdirk(Sdirk<DM, Eqn, LS>);

