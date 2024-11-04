use std::cell::RefCell;

use diffsol::{ode_solver::{problem, state::StateCommon}, DiffSl, DiffSlContext, OdeBuilder, OdeSolverMethod, OdeSolverProblem, OdeSolverState, StateRef, StateRefMut};
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

#[wasm_bindgen(js_name = DENSE_MATRIX_NAME)]
pub struct JsDenseMatrix(DM);

#[wasm_bindgen(js_class = DENSE_MATRIX_NAME)]
impl JsDenseMatrix {
    #[wasm_bindgen(constructor)]
    pub fn new(rows: usize, cols: usize) -> JsDenseMatrix {
        let m = DMatrix::zeros(rows, cols);
        JsDenseMatrix(m)
    }
    pub fn col(&self, i: usize) -> Float64Array {
        Float64Array::from(self.0.column(i).as_slice())
    }
}

#[wasm_bindgen(js_name = VECTOR_NAME)]
pub struct JsVector(V);

#[wasm_bindgen(js_class = VECTOR_NAME)]
impl JsVector {
    #[wasm_bindgen(constructor)]
    pub fn new(size: usize) -> JsVector {
        let v = V::zeros(size);
        JsVector(v)
    }
    pub fn as_array(&self) -> Float64Array {
        Float64Array::from(self.0.as_slice())
    }
}

#[wasm_bindgen(js_name = SOLUTION_NAME)]
pub struct JsSolveSolution {
    out: DM,
    times: Vec<T>,
}

#[wasm_bindgen(js_class = SOLUTION_NAME)]
impl JsSolveSolution {
    pub fn out(&self, i: usize) -> Float64Array{
        Float64Array::from(self.out.column(i).as_slice())
    }
    pub fn times(&self) -> Float64Array {
        Float64Array::from(self.times.as_slice())
    }
}

#[wasm_bindgen(js_name = DENSE_SOLUTION_NAME)]
pub struct JsDenseSolveSolution {
    out: DM,
}

#[wasm_bindgen(js_class = DENSE_SOLUTION_NAME)]
impl JsDenseSolveSolution {
    pub fn out(&self, i: usize) -> Float64Array{
        Float64Array::from(self.out.column(i).as_slice())
    }
}


enum State {
    BdfOwned(<Bdf<DM, Eqn, Nls> as OdeSolverMethod<Eqn>>::State),
    Bdf(Rc<RefCell<Bdf<DM, Eqn, Nls>>>),
    SdirkOwned(<Sdirk<DM, Eqn, LS> as OdeSolverMethod<Eqn>>::State),
    Sdirk(Rc<RefCell<Sdirk<DM, Eqn, LS>>>),
    Empty(()),
}

impl Default for State {
    fn default() -> Self {
        State::Empty(())
    }
}


#[wasm_bindgen(js_name = STATE_NAME)]
pub struct JsState(State);

#[wasm_bindgen(js_class = STATE_NAME)]
impl JsState {
    fn read_vector(&self, f: impl FnOnce(StateRef<'_, V>) -> &V) -> Result<Float64Array, JsDiffsolError> {
        let res = match &self.0 {
            State::BdfOwned(s) => Float64Array::from(f(s.as_ref()).as_slice()),
            State::Bdf(s) => Float64Array::from(f(s.borrow().state().ok_or(JsDiffsolError(DiffsolError::Other("Invalid state: Solver does not have state".to_string())))?).as_slice()),
            State::SdirkOwned(s) => Float64Array::from(f(s.as_ref()).as_slice()),
            State::Sdirk(s) => Float64Array::from(f(s.borrow().state().ok_or(JsDiffsolError(DiffsolError::Other("Invalid state: Solver does not have state".to_string())))?).as_slice()),
            _ => panic!("Invalid state"),
        };
        Ok(res)
    }
    fn read_scalar(&self, f: impl FnOnce(StateRef<'_, V>) -> T) -> Result<T, JsDiffsolError> {
        let res = match &self.0 {
            State::BdfOwned(s) => f(s.as_ref()),
            State::Bdf(s) => f(s.borrow().state().ok_or(JsDiffsolError(DiffsolError::Other("Invalid state: Solver does not have state".to_string())))?),
            State::SdirkOwned(s) => f(s.as_ref()),
            State::Sdirk(s) => f(s.borrow().state().ok_or(JsDiffsolError(DiffsolError::Other("Invalid state: Solver does not have state".to_string())))?),
            _ => panic!("Invalid state"),
        };
        Ok(res)
    }
    pub fn y(&self) -> Result<Float64Array, JsDiffsolError> {
        self.read_vector(|s| s.y)
    }

    pub fn dy(&self) -> Result<Float64Array, JsDiffsolError> {
        self.read_vector(|s| s.dy)
    }

    pub fn t(&self) -> Result<T, JsDiffsolError> {
        self.read_scalar(|s| s.t)
    }

    pub fn h(&self) -> Result<T, JsDiffsolError> {
        self.read_scalar(|s| s.h)
    }

}




macro_rules! impl_solver_state {
    ($js_name:ident, $name:ident, $solver_type:ty, $owned_state_varient:ident, $ref_state_varient:ident) => {
        #[wasm_bindgen(js_name = $js_name)]
        pub struct $name(Rc<RefCell<$solver_type>>);

        #[wasm_bindgen(js_class = $js_name)]
        impl $name {
            pub fn new_consistent_state(&self, problem: &JsOdeSolverProblem) -> Result<JsState, JsDiffsolError> {
                let s = self.0.borrow();
                let state = OdeSolverState::new(&problem.0, &*s).map_err(JsDiffsolError)?;
                Ok(JsState(State::$owned_state_varient(state)))
            }

            pub fn state(&self) -> JsState {
                JsState(State::$ref_state_varient(Rc::clone(&self.0)))
            }

            fn before_solve(&mut self, state: &mut JsState) -> Result<<$solver_type as OdeSolverMethod<Eqn>>::State, JsDiffsolError> {
                let state = std::mem::replace(&mut state.0, State::Empty(()));
                match state {
                    State::$owned_state_varient(s) => Ok(s),
                    State::$ref_state_varient(ref s) => Ok(s.borrow_mut().take_state().ok_or(JsDiffsolError(DiffsolError::Other("Invalid state: Solver does not have state".to_string())))?),
                    _ => Err(JsDiffsolError(DiffsolError::Other("Invalid state".to_string()))),
                }
            }

            fn after_solve(&self, state: &mut JsState) {
                state.0 = State::$ref_state_varient(Rc::clone(&self.0));
            }
            
            pub fn solve(&mut self, problem: &JsOdeSolverProblem, state: &mut JsState, t1: T) -> Result<JsSolveSolution, JsDiffsolError> {
                let extract_state = self.before_solve(state)?;
                let (out, times) = self.0.borrow_mut().solve(&problem.0, extract_state, t1).map_err(JsDiffsolError)?;
                self.after_solve(state);
                Ok(JsSolveSolution{out, times})
            }
            
            pub fn solve_dense(&mut self, problem: &JsOdeSolverProblem, state: &mut JsState, times: &[T]) -> Result<JsDenseSolveSolution, JsDiffsolError> {
                let extract_state = self.before_solve(state)?;
                let out = self.0.borrow_mut().solve_dense(&problem.0, extract_state, times).map_err(JsDiffsolError)?;
                self.after_solve(state);
                Ok(JsDenseSolveSolution{out})
            }
        }
    };
}

impl_solver_state!(BDF_SOLVER_NAME, JsBdf, Bdf<DM, Eqn, Nls>, BdfOwned, Bdf);
impl_solver_state!(SDIRK_SOLVER_NAME, JsSdirk, Sdirk<DM, Eqn, LS>, SdirkOwned, Sdirk);

#[wasm_bindgen(js_class = BDF_SOLVER_NAME)]
impl JsBdf {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> JsBdf {
        JsBdf(Rc::new(RefCell::new(Bdf::default())))
    }
}

#[wasm_bindgen(js_class = SDIRK_SOLVER_NAME)]
impl JsSdirk {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> JsSdirk {
        JsSdirk::esdirk34()
    }

    pub fn tr_bdf2() -> JsSdirk {
        JsSdirk(Rc::new(RefCell::new(Sdirk::tr_bdf2())))
    }

    pub fn esdirk34() -> JsSdirk {
        JsSdirk(Rc::new(RefCell::new(Sdirk::esdirk34())))
    }
}
