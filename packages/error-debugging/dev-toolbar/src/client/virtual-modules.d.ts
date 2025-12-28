/**
 * Type declarations for virtual modules used by the dev toolbar
 */

declare module 'virtual:visulima-dev-toolbar-options' {
  interface DevToolbarVirtualOptions {
    base: string;
    apps: {
      settings: boolean;
      timeline: boolean;
    };
    placement: 'bottom-left' | 'bottom-center' | 'bottom-right';
    defaultVisible: boolean;
  }
  const options: DevToolbarVirtualOptions;
  export default options;
}

declare module 'virtual:visulima-dev-toolbar-path:*' {
  const content: any;
  export default content;
  export * from '*';
}
