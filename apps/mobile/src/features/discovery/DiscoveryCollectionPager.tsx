import type { ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { DiscoveryCollectionPagerState } from './useDiscoveryCollectionPager';

export function DiscoveryCollectionPager({ pager, discovery, history }: {
  pager: DiscoveryCollectionPagerState; discovery: ReactNode; history: ReactNode;
}) {
  return <View style={styles.viewport} {...pager.panHandlers} onLayout={pager.onLayout}>
    <Animated.View style={[styles.track, { width: pager.width ? pager.width * 2 : '200%', transform: [{ translateX: pager.translateX }] }]}>
      {(['discovery', 'history'] as const).map(page => <View key={page} collapsable={false}
        pointerEvents={pager.active(page) ? 'auto' : 'none'}
        accessibilityElementsHidden={!pager.active(page)}
        importantForAccessibility={pager.active(page) ? 'auto' : 'no-hide-descendants'}
        style={[styles.page, pager.width > 0 && { width: pager.width }]}>
        {page === 'discovery' ? discovery : history}
      </View>)}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  track: { flex: 1, flexDirection: 'row' },
  page: { width: '50%', height: '100%' },
});
