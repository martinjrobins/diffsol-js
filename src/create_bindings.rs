/// Macro to wrap creation of modules from bindings.rs
///
/// Each binding created requires a module name, a matrix and solver type to
/// expose the underlying diffsol classes to python.
///
/// This approach could be considered compiler abuse as the implementation sets
/// the three required values and then pulls in private/bindings.rs which in
/// turn gets them from super::<name>. This is not pretty but it's the neatest
/// approach to coerce templated types into a common suite of module classes for
/// PyO3 without duplicating a lot of boilerplate and having upcasting issues.
#[macro_export]
macro_rules! create_binding {
    (
        $module_name:ident,
        $eqn_type:ty,
        $solver_type:ty
    ) => {
        #[path="."]
        pub mod $module_name {
            use super::*;

            // Module name, underlying type name and type
            const BASE_NAME: &str = "diffsol";
            const MODULE_NAME: &str = concatcp!(BASE_NAME, "/", "$module_name");
            const DIFFSL_NAME: &str = "DiffSl";
            const ODE_SOLVER_PROBLEM_NAME: &str = "OdeSolverProblem";
            const ODE_BUILDER_NAME: &str = "OdeBuilder";
            const BDF_SOLVER_NAME: &str = "Bdf";
            const SDIRK_SOLVER_NAME: &str = "Sdirk";
            type M = <$eqn_type as Op>::M;
            type T = <$eqn_type as Op>::T;
            type V = <$eqn_type as Op>::V;
            type DM = DMatrix<T>;
            type LS = $solver_type;
            type CG = CraneliftModule;
            type Eqn = DiffSl<M, CG>;
            type Nls = NewtonNonlinearSolver<M, LS>;


            // bindings accesses above values and types via super::
            mod bindings;
            pub use bindings::*;
        }
    };
}